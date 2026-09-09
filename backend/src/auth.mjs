import crypto from 'node:crypto';
import { query, transaction } from './db.mjs';

const JWT_ALG = 'HS256';
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);

function secret() {
  const value = process.env.APP_JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error('APP_JWT_SECRET must be configured with at least 32 characters');
  }
  return value;
}

export function uuid() {
  return crypto.randomUUID();
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function jsonB64(value) {
  return b64url(JSON.stringify(value));
}

function signPart(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function issueToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = jsonB64({ alg: JWT_ALG, typ: 'JWT' });
  const payload = jsonB64({
    sub: user.id,
    email: user.email,
    ver: Number(user.token_version || 0),
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  });
  const body = `${header}.${payload}`;
  return `${body}.${signPart(body)}`;
}

function decodeToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = signPart(`${header}.${payload}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (parsedHeader?.alg !== JWT_ALG || !parsed?.sub || !parsed?.exp) return null;
    if (Date.now() / 1000 >= Number(parsed.exp)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password, encoded) {
  try {
    const [scheme, saltPart, hashPart] = String(encoded || '').split('$');
    if (scheme !== 'scrypt' || !saltPart || !hashPart) return false;
    const expected = Buffer.from(hashPart, 'base64url');
    const actual = crypto.scryptSync(String(password), Buffer.from(saltPart, 'base64url'), expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function getAuthContext(authorization) {
  const token = String(authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return { user: null, token: null, isAdmin: false };
  const claims = decodeToken(token);
  if (!claims) return { user: null, token: null, isAdmin: false };

  const result = await query(
    `select id, email, token_version, created_at
       from app_users
      where id = $1`,
    [claims.sub],
  );
  const user = result.rows[0];
  if (!user || Number(user.token_version || 0) !== Number(claims.ver || 0)) {
    return { user: null, token: null, isAdmin: false };
  }
  const role = await query(
    `select 1 from user_roles where user_id = $1 and role = 'admin' limit 1`,
    [user.id],
  );
  return { user, token, isAdmin: role.rowCount > 0 };
}

export async function login(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const result = await query(
    `select id, email, password_hash, token_version, created_at
       from app_users
      where lower(email) = $1`,
    [normalized],
  );
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    const error = new Error('Invalid login credentials');
    error.status = 400;
    throw error;
  }
  const token = issueToken(user);
  return { user: publicUser(user), token };
}

export function publicUser(user, metadata = undefined) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    user_metadata: metadata || {},
  };
}

export async function register({ email, password, displayName, whatsapp }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    const error = new Error('Email inválido');
    error.status = 400;
    throw error;
  }
  if (String(password || '').length < 6) {
    const error = new Error('La contraseña debe tener al menos 6 caracteres');
    error.status = 400;
    throw error;
  }

  return transaction(async (client) => {
    const exists = await client.query(`select 1 from app_users where lower(email) = $1`, [normalized]);
    if (exists.rowCount) {
      const error = new Error('User already registered');
      error.status = 409;
      throw error;
    }

    const id = uuid();
    const passwordHash = hashPassword(password);
    const inserted = await client.query(
      `insert into app_users(id, email, password_hash)
       values ($1,$2,$3)
       returning id, email, token_version, created_at`,
      [id, normalized, passwordHash],
    );
    const user = inserted.rows[0];
    const name = String(displayName || '').trim() || normalized.split('@')[0];
    await client.query(
      `insert into profiles(id,email,display_name,whatsapp) values ($1,$2,$3,$4)`,
      [id, normalized, name, whatsapp || null],
    );
    await client.query(
      `insert into user_roles(id,user_id,role) values ($1,$2,'user')`,
      [uuid(), id],
    );
    const setting = await client.query(`select value from app_settings where key='welcome_credits'`);
    const welcome = Math.max(0, Number(setting.rows[0]?.value ?? 10) || 0);
    await client.query(`insert into user_credits(user_id,balance) values ($1,$2)`, [id, welcome]);
    if (welcome > 0) {
      await client.query(
        `insert into credit_transactions(id,user_id,amount,reason,type)
         values ($1,$2,$3,$4,'credit')`,
        [uuid(), id, welcome, 'Créditos de bienvenida'],
      );
    }
    return {
      user: publicUser(user, { display_name: name, whatsapp: whatsapp || null }),
      token: issueToken(user),
    };
  });
}

export async function changePassword(userId, newPassword) {
  if (String(newPassword || '').length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  const passwordHash = hashPassword(newPassword);
  const result = await query(
    `update app_users
        set password_hash=$2, token_version=token_version+1
      where id=$1
      returning id,email,token_version,created_at`,
    [userId, passwordHash],
  );
  return result.rows[0] || null;
}

export async function bootstrapAdmin() {
  const email = String(process.env.ADMIN_EMAIL || 'jorgitom18@gmail.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return { created: false, reason: 'ADMIN_PASSWORD_not_set' };
  }
  if (password.length < 6) throw new Error('ADMIN_PASSWORD must contain at least 6 characters');

  return transaction(async (client) => {
    let result = await client.query(
      `select id,email,token_version,created_at from app_users where lower(email)=$1`,
      [email],
    );
    let user = result.rows[0];
    if (!user) {
      const id = uuid();
      result = await client.query(
        `insert into app_users(id,email,password_hash)
         values ($1,$2,$3)
         returning id,email,token_version,created_at`,
        [id, email, hashPassword(password)],
      );
      user = result.rows[0];
      await client.query(
        `insert into profiles(id,email,display_name) values ($1,$2,'Administrador')`,
        [id, email],
      );
      await client.query(`insert into user_credits(user_id,balance) values ($1,0)`, [id]);
    } else if (process.env.ADMIN_PASSWORD_FORCE === 'true') {
      await client.query(
        `update app_users set password_hash=$2, token_version=token_version+1 where id=$1`,
        [user.id, hashPassword(password)],
      );
    }
    await client.query(
      `insert into user_roles(id,user_id,role) values ($1,$2,'admin')
       on conflict(user_id,role) do nothing`,
      [uuid(), user.id],
    );
    return { created: true, user_id: user.id, email };
  });
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
