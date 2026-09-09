import { ensureSchema, query, transaction } from '../backend/src/db.mjs';
import { verifyPassword } from '../backend/src/auth.mjs';
import { executeData } from '../backend/src/data.mjs';
import { wavespeedModels, wavespeedGenerate } from '../backend/src/functions/providers.mjs';
import { accessToken as paypalAccessToken, config as paypalConfig } from '../backend/src/functions/paypal.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }

  const result = {
    ok: false,
    database: false,
    jwt_configured: false,
    admin_password_configured: false,
    admin_password_match: false,
    admin_login: false,
    admin_role: false,
    credits_read: false,
    credits_transaction_rollback: false,
    wavespeed_models: false,
    wavespeed_image_models: false,
    wavespeed_video_models: false,
    generation_pipeline_health: false,
    paypal_auth: false,
    paypal_mode: null,
    mercadopago_auth: false,
    credit_packages_available: false,
  };

  try {
    await ensureSchema();
    result.database = true;

    const email = String(process.env.ADMIN_EMAIL || 'jorgitom18@gmail.com').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    result.admin_password_configured = Boolean(password);
    result.jwt_configured = String(process.env.APP_JWT_SECRET || '').length >= 32;

    const adminRow = await query(
      `select id,email,password_hash,token_version,created_at from app_users where lower(email)=$1 limit 1`,
      [email],
    );
    const user = adminRow.rows[0] || null;
    result.admin_password_match = Boolean(user && password && verifyPassword(password, user.password_hash));

    let auth = { user: null, isAdmin: false };
    if (user && result.admin_password_match) {
      const role = await query(`select 1 from user_roles where user_id=$1 and role='admin' limit 1`, [user.id]);
      auth = { user, isAdmin: role.rowCount > 0 };
      result.admin_role = auth.isAdmin;
      result.admin_login = result.admin_password_match && result.jwt_configured && result.admin_role;

      const credits = await executeData({
        table: 'user_credits',
        action: 'select',
        select: 'balance',
      }, auth);
      result.credits_read = Array.isArray(credits?.data) && credits.data.length === 1 && Number.isFinite(Number(credits.data[0]?.balance));

      const rollbackMarker = new Error('__SELFTEST_ROLLBACK__');
      try {
        await transaction(async (client) => {
          const beforeRow = await client.query('select balance from user_credits where user_id=$1 for update', [auth.user.id]);
          if (!beforeRow.rowCount) throw new Error('credits_row_missing');
          const before = Number(beforeRow.rows[0].balance);
          await client.query('update user_credits set balance=balance+1 where user_id=$1', [auth.user.id]);
          const afterRow = await client.query('select balance from user_credits where user_id=$1', [auth.user.id]);
          const after = Number(afterRow.rows[0]?.balance);
          if (after !== before + 1) throw new Error('credits_transaction_failed');
          result.credits_transaction_rollback = true;
          throw rollbackMarker;
        });
      } catch (error) {
        if (error !== rollbackMarker) throw error;
      }

      const packages = await executeData({
        table: 'credit_packages',
        action: 'select',
        select: 'id,active',
        filters: [{ column: 'active', op: 'eq', value: true }],
        limit: 1,
      }, auth);
      result.credit_packages_available = Array.isArray(packages?.data) && packages.data.length > 0;
    }

    try {
      const models = await wavespeedModels({ force: true });
      const list = Array.isArray(models?.data) ? models.data : [];
      result.wavespeed_models = models?.code === 0 && list.length > 0;
      result.wavespeed_image_models = list.some((m) => String(m?.type || m?.model_id || m?.name || '').toLowerCase().includes('image'));
      result.wavespeed_video_models = list.some((m) => String(m?.type || m?.model_id || m?.name || '').toLowerCase().includes('video'));
      if (auth?.user) {
        const health = await wavespeedGenerate({ action: 'health' }, auth);
        result.generation_pipeline_health = health?.code === 0 && health?.data?.healthy === true;
      }
    } catch (error) {
      result.wavespeed_error = error instanceof Error ? error.message : String(error);
    }

    try {
      const token = await paypalAccessToken();
      result.paypal_auth = Boolean(token);
      result.paypal_mode = paypalConfig().mode;
    } catch (error) {
      result.paypal_error = error instanceof Error ? error.message : String(error);
    }

    try {
      const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!mpToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
      const response = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${mpToken}` },
        signal: AbortSignal.timeout(8000),
      });
      result.mercadopago_auth = response.ok;
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        result.mercadopago_error = body?.message || `HTTP ${response.status}`;
      }
    } catch (error) {
      result.mercadopago_error = error instanceof Error ? error.message : String(error);
    }

    result.ok = Boolean(
      result.database &&
      result.jwt_configured &&
      result.admin_password_configured &&
      result.admin_password_match &&
      result.admin_login &&
      result.admin_role &&
      result.credits_read &&
      result.credits_transaction_rollback &&
      result.wavespeed_models &&
      result.wavespeed_image_models &&
      result.wavespeed_video_models &&
      result.generation_pipeline_health &&
      result.paypal_auth &&
      result.mercadopago_auth &&
      result.credit_packages_available
    );

    res.statusCode = result.ok ? 200 : 500;
    return res.end(JSON.stringify(result));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    res.statusCode = 500;
    return res.end(JSON.stringify(result));
  }
}
