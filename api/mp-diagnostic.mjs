import crypto from 'node:crypto';
import { query } from '../backend/src/db.mjs';

function cleanEnv(name) {
  let value = String(process.env[name] ?? '').trim();
  if (value.length >= 2 && ((value[0] === '"' && value.at(-1) === '"') || (value[0] === "'" && value.at(-1) === "'"))) value = value.slice(1, -1).trim();
  return value;
}

function safeError(data) {
  return {
    code: data?.code ?? data?.error ?? null,
    message: data?.message ?? data?.error_message ?? null,
    errors: Array.isArray(data?.errors) ? data.errors.map((e) => ({ code: e?.code ?? null, message: e?.message ?? e?.description ?? null, path: e?.path ?? null })) : null,
    cause: Array.isArray(data?.cause) ? data.cause.map((e) => ({ code: e?.code ?? null, description: e?.description ?? null })) : null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }
  try {
    const accessToken = cleanEnv('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) throw new Error('mp_not_configured');
    const r = await query(`
      select p.amount_uyu, u.email
      from payments p
      join app_users u on u.id=p.user_id
      where p.mp_response->>'provider'='mercadopago'
      order by p.created_at desc
      limit 1
    `);
    const last = r.rows[0];
    if (!last) throw new Error('no_recent_attempt');
    const amount = Number(last.amount_uyu).toFixed(2);
    const externalReference = `diag-${crypto.randomUUID()}`;
    const body = {
      type: 'online',
      processing_mode: 'manual',
      capture_mode: 'automatic_async',
      total_amount: amount,
      external_reference: externalReference,
      payer: { email: String(last.email || '').trim() },
      description: 'KNJ Pro credits',
      items: [{
        external_code: 'credits',
        title: 'KNJ Pro credits',
        description: 'Creditos para KNJ Pro',
        quantity: 1,
        unit_price: amount,
        unit_measure: 'unit',
        total_amount: amount,
      }],
      config: {
        statement_descriptor: 'KNJ PRO',
        notification_url: 'https://knjpro.site/api/functions/mp-webhook',
        online: {
          success_url: 'https://knjpro.site/payment/success',
          failure_url: 'https://knjpro.site/payment/failure',
          pending_url: 'https://knjpro.site/payment/pending',
          auto_return: 'approved',
        },
      },
    };
    const response = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify({ ok: response.ok, httpStatus: response.status, checkout_created: Boolean(data?.checkout_url), error: response.ok ? null : safeError(data) }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: String(error?.message || error) }));
  }
}
