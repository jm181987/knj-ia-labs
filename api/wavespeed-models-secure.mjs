import { ensureSchema, query } from '../backend/src/db.mjs';
import { getAuthContext } from '../backend/src/auth.mjs';
import { wavespeedModels } from '../backend/src/functions/providers.mjs';

const CLIENT_DEFAULTS = { markup: 3, creditsPerUsd: 37, mpFeePct: 7.99 };

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

async function pricingSettings() {
  const result = await query(
    `select key,value from app_settings where key=any($1::text[])`,
    [['pricing_markup','pricing_credits_per_usd','pricing_mp_fee_pct']],
  );
  const map = Object.fromEntries(result.rows.map((r) => [r.key, Number(r.value)]));
  return {
    markup: map.pricing_markup || 3,
    creditsPerUsd: map.pricing_credits_per_usd || 37,
    mpFeePct: Number.isFinite(map.pricing_mp_fee_pct) ? map.pricing_mp_fee_pct : 7.99,
  };
}

function computeCredits(basePrice, settings) {
  const price = Number(basePrice || 0);
  if (!price || price <= 0) return 1;
  const feeFactor = 1 - Math.min(Math.max(settings.mpFeePct, 0), 99) / 100;
  return Math.max(1, Math.ceil(price * (settings.markup / feeFactor) * settings.creditsPerUsd));
}

function opaqueBasePriceForCredits(credits) {
  const feeFactor = 1 - CLIENT_DEFAULTS.mpFeePct / 100;
  const factor = (CLIENT_DEFAULTS.markup / feeFactor) * CLIENT_DEFAULTS.creditsPerUsd;
  return Math.max(0.000001, (Math.max(1, Number(credits)) - 0.25) / factor);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    await ensureSchema();
    const auth = await getAuthContext(req.headers.authorization || '');
    const body = await readJson(req);
    const result = await wavespeedModels(body || {});
    if (!result || result.code !== 0 || auth?.isAdmin) return sendJson(res, 200, result);

    const settings = await pricingSettings();
    const data = (result.data || []).map((model) => {
      const credits = computeCredits(model.base_price, settings);
      // Preserve the existing frontend credit calculation without exposing WaveSpeed USD cost.
      // This value is an opaque credit-display coefficient, NOT the provider's USD price.
      return {
        ...model,
        base_price: opaqueBasePriceForCredits(credits),
      };
    });
    return sendJson(res, 200, { ...result, data });
  } catch (error) {
    return sendJson(res, Number(error?.status || 500), { error: error instanceof Error ? error.message : String(error) });
  }
}
