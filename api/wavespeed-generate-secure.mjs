import { ensureSchema } from '../backend/src/db.mjs';
import { getAuthContext } from '../backend/src/auth.mjs';
import { wavespeedModels, wavespeedGenerate } from '../backend/src/functions/providers.mjs';

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

function normalizePath(value) {
  return String(value || '').replace(/^\/api\/v3\//, '').replace(/^\/+/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    await ensureSchema();
    const auth = await getAuthContext(req.headers.authorization || '');
    const body = await readJson(req);

    if (body?.action === 'submit') {
      const requestedPath = normalizePath(body.modelPath);
      const catalog = await wavespeedModels({ force: false });
      if (!catalog || catalog.code !== 0) {
        return sendJson(res, 502, { error: catalog?.message || 'No se pudo validar el modelo' });
      }
      const model = (catalog.data || []).find((item) => {
        const apiPath = normalizePath(item.api_path);
        return apiPath === requestedPath || String(item.model_id || '') === requestedPath;
      });
      if (!model) return sendJson(res, 400, { error: 'Modelo no válido o no disponible' });

      // Never trust provider pricing or model metadata supplied by the browser.
      body.modelPath = normalizePath(model.api_path);
      body.modelLabel = model.name || body.modelLabel || model.model_id;
      body.basePrice = Number(model.base_price || 0);
    }

    const result = await wavespeedGenerate(body, auth);
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, Number(error?.status || 500), { error: error instanceof Error ? error.message : String(error) });
  }
}
