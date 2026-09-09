import { ensureSchema, closePool, query } from './db.mjs';
import { bootstrapAdmin } from './auth.mjs';
import { adminCleanBusinessData } from './data.mjs';

async function main() {
  await ensureSchema();

  if (String(process.env.CLEAN_START || '').toLowerCase() === 'true') {
    if (String(process.env.CONFIRM_CLEAN_START || '') !== 'DELETE_BUSINESS_DATA') {
      throw new Error('CLEAN_START requires CONFIRM_CLEAN_START=DELETE_BUSINESS_DATA');
    }
    await adminCleanBusinessData();
    console.log('[bootstrap] business/user history cleared; configuration tables preserved');
  }

  const admin = await bootstrapAdmin();
  if (!admin.created) {
    throw new Error('ADMIN_PASSWORD is required to create the initial administrator');
  }

  const counts = {};
  for (const table of ['app_users','profiles','user_roles','user_credits','payments','subscriptions','generations']) {
    const result = await query(`select count(*)::int as count from ${table}`);
    counts[table] = Number(result.rows[0]?.count || 0);
  }

  console.log('[bootstrap] ready', JSON.stringify({ admin_email: admin.email, counts }));
}

main()
  .catch((error) => {
    console.error('[bootstrap] failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => undefined);
  });
