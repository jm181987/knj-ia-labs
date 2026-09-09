import { ensureSchema } from '../backend/src/db.mjs';
import { getAuthContext } from '../backend/src/auth.mjs';
import { executeData } from '../backend/src/data.mjs';

const PRIVATE_SETTING_KEYS = new Set([
  'pricing_markup',
  'pricing_credits_per_usd',
  'pricing_mp_fee_pct',
]);

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function stripUsdPriceText(value) {
  if (typeof value !== 'string') return value;
  return value
    // Parenthesized/bracketed provider prices: (USD 0.003), [US$ 0.015], ($0.01 USD)
    .replace(/\s*[\(\[]\s*(?:(?:USD|US\$)\s*\$?\s*\d+(?:[.,]\d+)?|\$\s*\d+(?:[.,]\d+)?\s*(?:USD|US\$))\s*[\)\]]/gi, '')
    // Inline prices: " - USD 0.003", " USD $0.003", "$0.003 USD"
    .replace(/\s*(?:[-–—:]\s*)?(?:USD|US\$)\s*\$?\s*\d+(?:[.,]\d+)?\b/gi, '')
    .replace(/\s*\$\s*\d+(?:[.,]\d+)?\s*(?:USD|US\$)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:)\]])/g, '$1')
    .trim();
}

function sanitizeGeneration(row) {
  if (!row || typeof row !== 'object') return row;
  const next = { ...row };
  if (next.parameters && typeof next.parameters === 'object' && !Array.isArray(next.parameters)) {
    const parameters = { ...next.parameters };
    delete parameters.basePrice;
    delete parameters.base_price;
    delete parameters.providerPrice;
    delete parameters.provider_price;
    delete parameters.costUsd;
    delete parameters.cost_usd;
    next.parameters = parameters;
  }
  return next;
}

function sanitizePricingRow(row) {
  if (!row || typeof row !== 'object') return row;
  const next = { ...row };
  if ('description' in next) next.description = stripUsdPriceText(next.description);
  return next;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    await ensureSchema();
    const auth = await getAuthContext(req.headers.authorization || '');
    const original = await readJson(req);
    const body = { ...(original || {}) };
    let addedKeyColumn = false;

    if (!auth?.isAdmin && body.table === 'app_settings' && body.action === 'select') {
      const select = String(body.select || '*').trim();
      if (select !== '*' && !select.split(',').map((v) => v.trim()).includes('key')) {
        body.select = `key,${select}`;
        addedKeyColumn = true;
      }
    }

    const result = await executeData(body, auth);

    if (!auth?.isAdmin && Array.isArray(result?.data)) {
      if (body.table === 'app_settings') {
        result.data = result.data
          .filter((row) => !PRIVATE_SETTING_KEYS.has(String(row?.key || '')))
          .map((row) => {
            if (!addedKeyColumn) return row;
            const next = { ...row };
            delete next.key;
            return next;
          });
      }
      if (body.table === 'generations') {
        result.data = result.data.map(sanitizeGeneration);
      }
      if (body.table === 'pricing') {
        result.data = result.data.map(sanitizePricingRow);
      }
    }

    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, Number(error?.status || 500), {
      error: error instanceof Error ? error.message : String(error),
      ...(error?.details ? { details: error.details } : {}),
    });
  }
}
