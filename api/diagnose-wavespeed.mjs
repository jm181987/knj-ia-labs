import { ensureSchema, query } from '../backend/src/db.mjs';

const WAVESPEED_BASE = 'https://api.wavespeed.ai/api/v3';

function safeError(value) {
  if (value == null) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.slice(0, 1200);
}

function normalizePath(value) {
  return String(value || '').replace(/^https?:\/\/api\.wavespeed\.ai\/api\/v3\//, '').replace(/^\/api\/v3\//, '').replace(/^\/+/, '');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }

  const out = {
    ok: false,
    database: false,
    jwt_configured: String(process.env.APP_JWT_SECRET || '').length >= 32,
    wavespeed_key_configured: Boolean(process.env.WAVESPEED_API_KEY),
    wavespeed_models_ok: false,
    wavespeed_balance_ok: false,
    wavespeed_balance: null,
    provider_health: null,
    recent_generations: [],
    model_schema_check: null,
    live_task_check: null,
  };

  try {
    await ensureSchema();
    out.database = true;

    const recent = await query(`
      select id, model, status, task_id, error_message, created_at, parameters
      from generations
      order by created_at desc
      limit 12
    `);
    out.recent_generations = recent.rows.map((r) => ({
      id: r.id,
      model: r.model,
      status: r.status,
      has_task_id: Boolean(r.task_id),
      error_message: safeError(r.error_message),
      created_at: r.created_at,
      model_path: normalizePath(r.parameters?.modelPath),
      payload_keys: Object.keys(r.parameters || {}).filter((k) => !['user_id','basePrice','costCredits','modelPath'].includes(k)).sort(),
    }));

    const health = await query(`select value from app_settings where key='provider_health' limit 1`);
    out.provider_health = health.rows[0]?.value || null;

    const key = process.env.WAVESPEED_API_KEY;
    let rawModels = [];
    if (key) {
      const modelsRes = await fetch(`${WAVESPEED_BASE}/models`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(12000),
      });
      const modelsBody = await modelsRes.json().catch(() => ({}));
      out.wavespeed_models_ok = modelsRes.ok;
      if (!modelsRes.ok) out.models_error = safeError(modelsBody?.message || modelsBody?.error || modelsBody);
      rawModels = Array.isArray(modelsBody?.data) ? modelsBody.data : [];

      const balanceRes = await fetch(`${WAVESPEED_BASE}/balance`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(12000),
      });
      const balanceBody = await balanceRes.json().catch(() => ({}));
      out.wavespeed_balance_ok = balanceRes.ok;
      if (balanceRes.ok) out.wavespeed_balance = balanceBody?.data?.balance ?? null;
      else out.balance_error = safeError(balanceBody?.message || balanceBody?.error || balanceBody);

      const latestWithPath = recent.rows.find((r) => normalizePath(r.parameters?.modelPath));
      if (latestWithPath) {
        const targetPath = normalizePath(latestWithPath.parameters?.modelPath);
        let matched = null;
        let matchedSchema = null;
        for (const m of rawModels) {
          const schemas = m?.api_schema?.api_schemas || [];
          for (const s of schemas) {
            const apiPath = normalizePath(s?.api_path);
            if (apiPath && apiPath === targetPath) {
              matched = m;
              matchedSchema = s;
              break;
            }
          }
          if (matched) break;
        }
        const required = Array.isArray(matchedSchema?.request_schema?.required) ? matchedSchema.request_schema.required : [];
        const props = matchedSchema?.request_schema?.properties || {};
        const payloadKeys = Object.keys(latestWithPath.parameters || {}).filter((k) => !['user_id','basePrice','costCredits','modelPath'].includes(k));
        const missing = required.filter((k) => !(k in (latestWithPath.parameters || {})) || latestWithPath.parameters?.[k] === '' || latestWithPath.parameters?.[k] == null);
        const unknown = payloadKeys.filter((k) => !(k in props));
        out.model_schema_check = {
          latest_generation_id: latestWithPath.id,
          model: latestWithPath.model,
          model_path: targetPath,
          catalog_match: Boolean(matched),
          catalog_model_id: matched?.model_id || null,
          required_fields: required,
          payload_keys: payloadKeys.sort(),
          missing_required_fields: missing,
          unknown_payload_fields: unknown,
        };

        if (latestWithPath.task_id) {
          let taskRes = await fetch(`${WAVESPEED_BASE}/predictions/${encodeURIComponent(latestWithPath.task_id)}/result`, {
            headers: { Authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(12000),
          });
          let taskBody = await taskRes.json().catch(() => ({}));
          if (!taskRes.ok) {
            taskRes = await fetch(`${WAVESPEED_BASE}/predictions/${encodeURIComponent(latestWithPath.task_id)}`, {
              headers: { Authorization: `Bearer ${key}` },
              signal: AbortSignal.timeout(12000),
            });
            taskBody = await taskRes.json().catch(() => ({}));
          }
          const d = taskBody?.data || taskBody;
          out.live_task_check = {
            http_ok: taskRes.ok,
            http_status: taskRes.status,
            status: d?.status || null,
            error: safeError(d?.error || d?.message || (!taskRes.ok ? taskBody : null)),
          };
        }
      }
    }

    out.ok = Boolean(out.database && out.jwt_configured && out.wavespeed_key_configured && out.wavespeed_models_ok && out.wavespeed_balance_ok);
    res.statusCode = 200;
    return res.end(JSON.stringify(out));
  } catch (error) {
    out.error = error instanceof Error ? error.message : String(error);
    res.statusCode = 500;
    return res.end(JSON.stringify(out));
  }
}
