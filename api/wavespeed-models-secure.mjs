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

function stripProviderPriceText(value) {
  if (typeof value !== 'string') return value;
  return value
    // Examples: (USD 0.003), [USD 0.015], (US$ 0.01)
    .replace(/\s*[\(\[]\s*(?:USD|US\$)\s*\$?\s*\d+(?:\.\d+)?\s*[\)\]]/gi, '')
    // Examples: " - USD 0.003", " USD $0.003"
    .replace(/\s*(?:[-–—:]\s*)?(?:USD|US\$)\s*\$?\s*\d+(?:\.\d+)?\b/gi, '')
    // Examples: " $0.003 USD"
    .replace(/\s*\$\s*\d+(?:\.\d+)?\s*(?:USD)?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:)\]])/g, '$1')
    .trim();
}

function sanitizeSchemaText(value) {
  if (Array.isArray(value)) return value.map(sanitizeSchemaText);
  if (!value || typeof value !== 'object') return stripProviderPriceText(value);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'description' || key === 'title' || key === 'label') out[key] = stripProviderPriceText(item);
    else if (item && typeof item === 'object') out[key] = sanitizeSchemaText(item);
    else out[key] = item;
  }
  return out;
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
      // Clients receive only credit-facing pricing. Any provider USD pricing embedded
      // in model names/descriptions/schema text is stripped before it reaches the browser.
      return {
        ...model,
        name: stripProviderPriceText(model.name),
        description: stripProviderPriceText(model.description),
        request_schema: sanitizeSchemaText(model.request_schema),
        base_price: opaqueBasePriceForCredits(credits),
      };
    });
    return sendJson(res, 200, { ...result, data });
  } catch (error) {
    return sendJson(res, Number(error?.status || 500), { error: error instanceof Error ? error.message : String(error) });
  }
}
