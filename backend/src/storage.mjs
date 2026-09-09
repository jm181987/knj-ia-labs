import { query, transaction } from './db.mjs';
import { uuid } from './auth.mjs';

const BUCKETS = new Set(['reference-images', 'avatar-audio', 'avatar-videos', 'testimonials', 'public']);
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function validBucket(bucket) {
  return BUCKETS.has(String(bucket || ''));
}

function validPath(path) {
  const value = String(path || '');
  return value.length > 0 && value.length <= 500 && !value.includes('..') && !value.startsWith('/');
}

function check(bucket, path) {
  if (!validBucket(bucket)) throw Object.assign(new Error('Bucket inválido'), { status: 400 });
  if (!validPath(path)) throw Object.assign(new Error('Ruta inválida'), { status: 400 });
}

export async function startUpload(auth, body) {
  if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 });
  const { bucket, path, contentType, size } = body || {};
  check(bucket, path);
  const expectedSize = Number(size || 0);
  if (!Number.isFinite(expectedSize) || expectedSize < 0 || expectedSize > MAX_FILE_BYTES) {
    throw Object.assign(new Error('Archivo demasiado grande'), { status: 413 });
  }
  const id = uuid();
  await query(
    `insert into storage_uploads(id,bucket,path,owner_id,content_type,expected_size)
     values ($1,$2,$3,$4,$5,$6)`,
    [id, bucket, path, auth.user.id, contentType || 'application/octet-stream', expectedSize],
  );
  return { uploadId: id };
}

export async function uploadPart(auth, body) {
  if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 });
  const uploadId = String(body?.uploadId || '');
  const partNo = Number(body?.partNo);
  const data = Buffer.from(String(body?.base64 || ''), 'base64');
  if (!uploadId || !Number.isInteger(partNo) || partNo < 0 || data.length > 2 * 1024 * 1024) {
    throw Object.assign(new Error('Parte inválida'), { status: 400 });
  }
  const own = await query(`select 1 from storage_uploads where id=$1 and owner_id=$2`, [uploadId, auth.user.id]);
  if (!own.rowCount) throw Object.assign(new Error('Upload no encontrado'), { status: 404 });
  await query(
    `insert into storage_upload_parts(upload_id,part_no,data) values ($1,$2,$3)
     on conflict(upload_id,part_no) do update set data=excluded.data`,
    [uploadId, partNo, data],
  );
  return { ok: true };
}

export async function finishUpload(auth, body) {
  if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 });
  const uploadId = String(body?.uploadId || '');
  return transaction(async (client) => {
    const uploadResult = await client.query(`select * from storage_uploads where id=$1 and owner_id=$2 for update`, [uploadId, auth.user.id]);
    const upload = uploadResult.rows[0];
    if (!upload) throw Object.assign(new Error('Upload no encontrado'), { status: 404 });
    const parts = await client.query(`select data from storage_upload_parts where upload_id=$1 order by part_no`, [uploadId]);
    const data = Buffer.concat(parts.rows.map((r) => r.data));
    if (data.length !== Number(upload.expected_size)) {
      throw Object.assign(new Error(`Upload incompleto: ${data.length}/${upload.expected_size}`), { status: 400 });
    }
    await client.query(
      `insert into storage_objects(bucket,path,owner_id,content_type,size_bytes,data)
       values ($1,$2,$3,$4,$5,$6)
       on conflict(bucket,path) do update set
         owner_id=excluded.owner_id,content_type=excluded.content_type,size_bytes=excluded.size_bytes,data=excluded.data`,
      [upload.bucket, upload.path, auth.user.id, upload.content_type, data.length, data],
    );
    await client.query(`delete from storage_uploads where id=$1`, [uploadId]);
    return { bucket: upload.bucket, path: upload.path, size: data.length };
  });
}

export async function removeObjects(auth, bucket, paths) {
  if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 });
  if (!validBucket(bucket)) throw Object.assign(new Error('Bucket inválido'), { status: 400 });
  const list = Array.isArray(paths) ? paths.filter(validPath) : [];
  if (!list.length) return [];
  const result = auth.isAdmin
    ? await query(`delete from storage_objects where bucket=$1 and path=any($2::text[]) returning path`, [bucket, list])
    : await query(`delete from storage_objects where bucket=$1 and path=any($2::text[]) and owner_id=$3 returning path`, [bucket, list, auth.user.id]);
  return result.rows;
}

export async function getObject(bucket, objectPath) {
  check(bucket, objectPath);
  const result = await query(
    `select content_type,size_bytes,data,updated_at from storage_objects where bucket=$1 and path=$2`,
    [bucket, objectPath],
  );
  return result.rows[0] || null;
}
