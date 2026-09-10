import { query } from '../backend/src/db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }
  try {
    const r = await query(`
      select id, status, created_at, mp_response
      from payments
      where mp_response->>'provider' = 'mercadopago'
      order by created_at desc
      limit 5
    `);
    const attempts = r.rows.map((row) => {
      const e = row.mp_response?.error || null;
      return {
        status: row.status,
        created_at: row.created_at,
        api: row.mp_response?.api || null,
        error: e ? {
          stage: e.stage || null,
          httpStatus: e.httpStatus || null,
          code: e.code || null,
          message: e.message || null,
        } : null,
        has_order: Boolean(row.mp_response?.order?.id),
      };
    });
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify({ ok: true, attempts }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: String(error?.message || error) }));
  }
}
