import { query } from '../db.mjs';
import { uuid } from '../auth.mjs';
import {
  checkAndIncrementRateLimit,
  debitCreditsForUser,
  refundCreditsForUser,
  hasRole,
} from '../rpc.mjs';

const WAVESPEED_BASE = 'https://api.wavespeed.ai/api/v3';
const GENERIC_PROVIDER_ERROR = 'El sistema no responde, intentá en unos minutos.';
const RATE_LIMIT_PER_MINUTE = 10;
let modelCache = null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no configurado`);
  return value;
}

function requireUser(auth) {
  if (!auth?.user) throw Object.assign(new Error('No autenticado'), { status: 401 });
  return auth.user;
}

const RES_MULT = {
  '256p': .5, '360p': .7, '480p': 1, '540p': 1.2, '576p': 1.3,
  '720p': 1.5, '768p': 1.7, '1080p': 2.5, '1440p': 3.5, '2k': 3.5,
  '4k': 5, '2160p': 5,
};
function resolutionMultiplier(value) {
  if (value == null) return 1;
  const s = String(value).toLowerCase().trim();
  if (RES_MULT[s]) return RES_MULT[s];
  const m = s.match(/(\d{2,5})\s*[x*×]\s*(\d{2,5})/);
  if (m) return Math.max(.5, Math.min(8, (Number(m[1]) * Number(m[2])) / 410000));
  const n = Number(s.replace(/[^\d]/g, ''));
  return RES_MULT[`${n}p`] || 1;
}
function numVal(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function dynamicMultiplier(values = {}) {
  let mult = 1;
  const durKey = ['duration','num_seconds','seconds','video_length'].find((k) => k in values);
  if (durKey) { const d = numVal(values[durKey]); if (d && d > 0) mult *= d / 5; }
  const countKey = ['num_images','image_count','n','num_outputs','batch_size'].find((k) => k in values);
  if (countKey) { const c = numVal(values[countKey]); if (c && c > 0) mult *= c; }
  const resKey = ['resolution','size','video_resolution'].find((k) => k in values);
  if (resKey) mult *= resolutionMultiplier(values[resKey]);
  const frameKey = ['num_frames','frames'].find((k) => k in values);
  if (frameKey) { const f = numVal(values[frameKey]); if (f && f > 0) mult *= f / 81; }
  const stepKey = ['num_inference_steps','steps'].find((k) => k in values);
  if (stepKey) { const s = numVal(values[stepKey]); if (s && s > 30) mult *= s / 30; }
  return Math.max(.25, Math.min(mult, 20));
}
function modelSpecificMultiplier(modelPath, values = {}) {
  const path = String(modelPath || '').toLowerCase();
  const dur = numVal(values.duration) || numVal(values.num_seconds) || numVal(values.seconds);
  const families = [
    ['multitalk',5,4],['lipsync',5,4],['lip-sync',5,4],['dubbing',5,6],
    ['video-dubbing',5,6],['audio-to-audio',5,4],['text-to-audio',5,3],
    ['video-to-audio',5,4],['video-extend',5,2],['digital-human',5,4],['portrait-transfer',5,3],
  ];
  for (const [match, base, worstCase] of families) {
    if (path.includes(match)) return dur && dur > 0 ? Math.max(1, dur / base) : worstCase;
  }
  if ((path.includes('veo') || path.includes('sora')) && dur && dur > 8) return dur / 8;
  return 1;
}
async function pricingSettings() {
  const result = await query(`select key,value from app_settings where key=any($1::text[])`, [[
    'pricing_markup','pricing_credits_per_usd','pricing_mp_fee_pct',
  ]]);
  const map = Object.fromEntries(result.rows.map((r) => [r.key, Number(r.value)]));
  return {
    markup: map.pricing_markup || 3,
    creditsPerUsd: map.pricing_credits_per_usd || 37,
    mpFeePct: Number.isFinite(map.pricing_mp_fee_pct) ? map.pricing_mp_fee_pct : 7.99,
  };
}
function computeCost(basePrice, markup, creditsPerUsd, mpFeePct) {
  if (!basePrice || basePrice <= 0) return 1;
  const feeFactor = 1 - Math.min(Math.max(mpFeePct, 0), 99) / 100;
  return Math.max(1, Math.ceil(basePrice * (markup / feeFactor) * creditsPerUsd));
}
async function providerCall(modelPath, payload, apiKey) {
  const res = await fetch(`${WAVESPEED_BASE}/${String(modelPath).replace(/^\/+/, '')}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.message || data?.error || `provider HTTP ${res.status}`);
    error.providerStatus = res.status;
    throw error;
  }
  return data;
}
async function providerPoll(taskId, apiKey) {
  let res = await fetch(`${WAVESPEED_BASE}/predictions/${taskId}/result`, { headers: { Authorization: `Bearer ${apiKey}` } });
  let data = await res.json().catch(() => ({}));
  if (!res.ok) {
    res = await fetch(`${WAVESPEED_BASE}/predictions/${taskId}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Polling error ${res.status}`);
  }
  return data;
}
async function healthSetting(healthy, latency, error = null) {
  await query(
    `insert into app_settings(key,value) values ('provider_health',$1::jsonb)
     on conflict(key) do update set value=excluded.value`,
    [JSON.stringify({ healthy, checked_at: new Date().toISOString(), latency_ms: latency, error })],
  );
}

export async function wavespeedModels(body = {}) {
  const apiKey = requireEnv('WAVESPEED_API_KEY');
  const force = body.force === true || body.force === 1 || body.force === '1';
  if (!force && modelCache && Date.now() - modelCache.at < 30 * 60 * 1000) {
    return { code: 0, data: modelCache.data, cached: true };
  }
  const res = await fetch(`${WAVESPEED_BASE}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) return { code: 1, message: raw?.message || `HTTP ${res.status}` };
  const compact = (Array.isArray(raw?.data) ? raw.data : []).map((m) => {
    const schema = m?.api_schema?.api_schemas?.find((s) => s.type === 'model_run') || m?.api_schema?.api_schemas?.[0];
    return {
      model_id: m.model_id, name: m.name, type: m.type, description: m.description,
      base_price: m.base_price, sort_order: m.sort_order,
      request_schema: schema?.request_schema || null, api_path: schema?.api_path || null,
    };
  }).filter((m) => m.request_schema && m.api_path);
  modelCache = { at: Date.now(), data: compact };
  return { code: 0, data: compact, cached: false };
}

export async function wavespeedBalance(auth) {
  if (!auth?.isAdmin) throw Object.assign(new Error('No autorizado'), { status: 403 });
  const apiKey = requireEnv('WAVESPEED_API_KEY');
  const res = await fetch(`${WAVESPEED_BASE}/balance`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.message || `WaveSpeed ${res.status}`), { status: 502 });
  return { balance_usd: data?.data?.balance ?? 0 };
}

export async function wavespeedGenerate(body, auth) {
  const user = requireUser(auth);
  const apiKey = requireEnv('WAVESPEED_API_KEY');
  const action = body?.action;
  if (action === 'health') {
    const t0 = Date.now();
    try {
      const res = await fetch(`${WAVESPEED_BASE}/predictions/__healthcheck__/result`, {
        headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5000),
      });
      const latency = Date.now() - t0;
      const healthy = res.status < 500;
      await healthSetting(healthy, latency);
      return { code: 0, data: { healthy, latency_ms: latency } };
    } catch (e) {
      const latency = Date.now() - t0;
      await healthSetting(false, latency, e instanceof Error ? e.message : String(e));
      return { code: 0, data: { healthy: false, latency_ms: latency } };
    }
  }
  if (action === 'submit') {
    const { type, modelPath, modelLabel, prompt, payload = {}, basePrice } = body;
    if (!modelPath || !prompt) throw Object.assign(new Error('modelPath y prompt requeridos'), { status: 400 });
    const allowed = await checkAndIncrementRateLimit(user.id, RATE_LIMIT_PER_MINUTE);
    if (!allowed) return { code: 3, message: 'Demasiadas generaciones. Esperá un minuto antes de intentar de nuevo.' };
    const settings = await pricingSettings();
    const isAdmin = auth.isAdmin || await hasRole(user.id, 'admin');
    const effectivePrice = (Number(basePrice) || 0) * dynamicMultiplier(payload) * modelSpecificMultiplier(modelPath, payload);
    const cost = computeCost(effectivePrice, settings.markup, settings.creditsPerUsd, settings.mpFeePct);
    if (!isAdmin) {
      try { await debitCreditsForUser(user.id, cost, `Generación: ${modelLabel || modelPath}`); }
      catch (e) {
        if (String(e?.message).includes('insufficient_credits')) return { code: 2, message: `Saldo insuficiente. Necesitás ${cost} créditos.` };
        throw e;
      }
    }
    const refund = async (reason, generationId = null) => {
      if (!isAdmin) await refundCreditsForUser(user.id, cost, reason, generationId).catch((e) => console.error('[refund]', e));
    };
    let ws;
    try {
      ws = await providerCall(modelPath, Object.keys(payload).length ? payload : { prompt }, apiKey);
      healthSetting(true, null).catch(() => {});
    } catch (e) {
      await refund(`Reembolso (error proveedor): ${modelLabel || modelPath}`);
      healthSetting(false, null, e instanceof Error ? e.message : String(e)).catch(() => {});
      return { code: 1, message: isAdmin ? `Proveedor ${e.providerStatus || ''}: ${e.message}`.trim() : GENERIC_PROVIDER_ERROR };
    }
    const taskId = ws?.data?.id || ws?.id;
    if (!taskId) {
      await refund(`Reembolso (sin task_id): ${modelLabel || modelPath}`);
      return { code: 1, message: isAdmin ? `Proveedor sin task_id: ${JSON.stringify(ws).slice(0,300)}` : GENERIC_PROVIDER_ERROR };
    }
    const id = uuid();
    await query(
      `insert into generations(id,type,prompt,user_id,model,aspect_ratio,duration,negative_prompt,reference_image_url,task_id,status,parameters)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'processing',$11::jsonb)`,
      [id, type || 'image', prompt, user.id, modelLabel || modelPath, payload.aspect_ratio || payload.size || null,
       payload.duration != null ? String(payload.duration) : null, payload.negative_prompt || null,
       payload.image || payload.image_url || null, taskId,
       JSON.stringify({ modelPath, basePrice, costCredits: cost, ...payload, user_id: user.id })],
    );
    await query(
      `update credit_transactions set generation_id=$1 where id=(
         select id from credit_transactions where user_id=$2 and generation_id is null and type='debit'
         order by created_at desc limit 1
       )`,
      [id, user.id],
    );
    return { code: 0, data: { id, task_id: taskId, cost } };
  }
  if (action === 'poll') {
    const id = body?.generation_id;
    if (!id) throw Object.assign(new Error('generation_id requerido'), { status: 400 });
    const result = auth.isAdmin
      ? await query(`select * from generations where id=$1`, [id])
      : await query(`select * from generations where id=$1 and user_id=$2`, [id, user.id]);
    const gen = result.rows[0];
    if (!gen) throw Object.assign(new Error('Generación no encontrada'), { status: 404 });
    if (['completed','failed'].includes(gen.status)) return { code: 0, data: { status: gen.status, urls: gen.result_urls, error: gen.error_message } };
    if (!gen.task_id) return { code: 0, data: { status: gen.status } };
    const raw = await providerPoll(gen.task_id, apiKey);
    const data = raw?.data || raw;
    if (data?.status === 'completed') {
      await query(`update generations set status='completed',result_urls=$2::jsonb where id=$1`, [id, JSON.stringify(data.outputs || [])]);
      return { code: 0, data: { status: 'completed', urls: data.outputs || [] } };
    }
    if (data?.status === 'failed') {
      await query(`update generations set status='failed',error_message=$2 where id=$1`, [id, data.error || 'provider failed']);
      const cost = Number(gen.parameters?.costCredits || 0);
      if (gen.user_id && cost && !(await hasRole(gen.user_id, 'admin'))) {
        await refundCreditsForUser(gen.user_id, cost, `Reembolso por fallo: ${gen.model}`, gen.id).catch(() => {});
      }
      return { code: 0, data: { status: 'failed', error: GENERIC_PROVIDER_ERROR } };
    }
    return { code: 0, data: { status: 'processing' } };
  }
  throw Object.assign(new Error('action inválida'), { status: 400 });
}

const LANG_NAMES = { es: 'Spanish (Rioplatense, neutral and concise)', en: 'English', pt: 'Brazilian Portuguese' };
export async function translateModel(body) {
  const { model_id, lang = 'es', description = '', fields = {} } = body || {};
  if (!model_id) return { code: 1, message: 'model_id required' };
  if (!LANG_NAMES[lang]) return { code: 1, message: 'lang not supported' };
  const cacheKey = `model_tr:${lang}:${model_id}`;
  const cached = await query(`select value from app_settings where key=$1`, [cacheKey]);
  if (cached.rows[0]?.value) return { code: 0, data: cached.rows[0].value, cached: true };
  if (lang === 'en') {
    const value = {
      description,
      field_labels: Object.fromEntries(Object.entries(fields).map(([k,v]) => [k, v?.label || k])),
      field_descriptions: Object.fromEntries(Object.entries(fields).map(([k,v]) => [k, v?.description || ''])),
    };
    await query(`insert into app_settings(key,value) values ($1,$2::jsonb) on conflict(key) do update set value=excluded.value`, [cacheKey, JSON.stringify(value)]);
    return { code: 0, data: value, cached: false };
  }
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { code: 1, message: 'LOVABLE_API_KEY missing' };
  const fieldList = Object.entries(fields).map(([k,v]) => ({ key:k, original_label:v?.label || k, original_description:v?.description || '' }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role:'system', content:`Translate AI model UI strings into ${LANG_NAMES[lang]}. Keep technical terms concise. Return only requested fields.` },
          { role:'user', content:JSON.stringify({ model_description: description, fields: fieldList }) },
        ],
        tools:[{ type:'function', function:{ name:'return_translations', parameters:{ type:'object', properties:{ description:{type:'string'}, fields:{type:'array',items:{type:'object',properties:{key:{type:'string'},label:{type:'string'},description:{type:'string'}},required:['key','label','description']}}}, required:['description','fields'] } } }],
        tool_choice:{ type:'function', function:{ name:'return_translations' } },
      }),
    });
    if (!res.ok) return { code:1, message:res.status === 429 ? 'rate_limited' : `AI ${res.status}` };
    const ai = await res.json();
    const args = ai?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { code:1, message:'no tool_call' };
    const parsed = JSON.parse(args);
    const value = {
      description: parsed.description || description,
      field_labels: Object.fromEntries((parsed.fields || []).map((f) => [f.key,f.label])),
      field_descriptions: Object.fromEntries((parsed.fields || []).map((f) => [f.key,f.description])),
    };
    await query(`insert into app_settings(key,value) values ($1,$2::jsonb) on conflict(key) do update set value=excluded.value`, [cacheKey, JSON.stringify(value)]);
    return { code:0, data:value, cached:false };
  } catch (e) {
    return { code:1, message:e?.name === 'AbortError' ? 'ai_timeout' : String(e?.message || e) };
  } finally { clearTimeout(timer); }
}
