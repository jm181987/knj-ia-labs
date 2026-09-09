import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for KNJ IA Labs backend');
}

const sslEnabled = ['1', 'true', 'require'].includes(String(process.env.DB_SSL || '').toLowerCase());

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => {
  console.error('[db] unexpected pool error', error);
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const value = await fn(client);
    await client.query('commit');
    return value;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

let schemaPromise;
export function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const sql = await fs.readFile(path.resolve(here, '../schema.sql'), 'utf8');
      await pool.query(sql);
      await pool.query("delete from storage_uploads where created_at < now() - interval '1 day'");
      console.log('[db] schema ready');
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

export async function closePool() {
  await pool.end();
}
