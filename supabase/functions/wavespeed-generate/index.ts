import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";
const RATE_LIMIT_PER_MINUTE = 10;
const GENERIC_PROVIDER_ERROR = "El sistema no responde, intentá en unos minutos.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

// Logger estructurado (JSON por línea, fácil de filtrar)
function log(level: "info" | "warn" | "error", event: string, ctx: Record<string, unknown> = {}) {
  const entry = { ts: new Date().toISOString(), level, event, ...ctx };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

async function callWaveSpeed(modelPath: string, payload: Record<string, unknown>, apiKey: string) {
  const url = `${WAVESPEED_BASE}/${modelPath.replace(/^\/+/, "")}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  log("info", "provider_call", { modelPath, status: res.status, latency_ms: Date.now() - t0 });
  if (!res.ok) {
    // Error técnico real (para logs)
    const technical = data?.message || data?.error || `provider HTTP ${res.status}`;
    const err: any = new Error(technical);
    err.providerStatus = res.status;
    err.userMessage = GENERIC_PROVIDER_ERROR;
    throw err;
  }
  return data;
}

async function pollWaveSpeed(taskId: string, apiKey: string) {
  const res = await fetch(`${WAVESPEED_BASE}/predictions/${taskId}/result`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const r2 = await fetch(`${WAVESPEED_BASE}/predictions/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    const d2 = await r2.json().catch(() => ({}));
    if (!r2.ok) throw new Error(d2?.message || `Polling error ${r2.status}`);
    return d2;
  }
  return data;
}

async function getPricingSettings(supabase: any): Promise<{ markup: number; creditsPerUsd: number; mpFeePct: number }> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["pricing_markup", "pricing_credits_per_usd", "pricing_mp_fee_pct"]);
  const map: Record<string, number> = {};
  for (const r of data || []) {
    const v = typeof r.value === "string" ? Number(r.value) : Number(r.value);
    if (!isNaN(v)) map[r.key] = v;
  }
  return {
    markup: map.pricing_markup || 3,
    creditsPerUsd: map.pricing_credits_per_usd || 37,
    mpFeePct: map.pricing_mp_fee_pct ?? 7.99,
  };
}

function computeCost(basePrice: number, markup: number, creditsPerUsd: number, mpFeePct: number): number {
  if (!basePrice || basePrice <= 0) return 1;
  const feeFactor = 1 - Math.min(Math.max(mpFeePct, 0), 99) / 100;
  const effectiveMarkup = markup / feeFactor;
  return Math.max(1, Math.ceil(basePrice * effectiveMarkup * creditsPerUsd));
}

// ===== Multiplicador dinámico según parámetros del usuario =====
const RES_MULT: Record<string, number> = {
  "256p": 0.5, "360p": 0.7, "480p": 1, "540p": 1.2, "576p": 1.3,
  "720p": 1.5, "768p": 1.7, "1080p": 2.5, "1440p": 3.5, "2k": 3.5,
  "4k": 5, "2160p": 5,
};
function resolutionMultiplier(value: unknown): number {
  if (value == null) return 1;
  const s = String(value).toLowerCase().trim();
  if (RES_MULT[s]) return RES_MULT[s];
  const m = s.match(/(\d{2,5})\s*[x*×]\s*(\d{2,5})/);
  if (m) {
    const px = Number(m[1]) * Number(m[2]);
    return Math.max(0.5, Math.min(8, px / 410_000));
  }
  const num = Number(s.replace(/[^\d]/g, ""));
  if (Number.isFinite(num) && num > 0) {
    const k = `${num}p`;
    if (RES_MULT[k]) return RES_MULT[k];
  }
  return 1;
}
function numVal(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function dynamicMultiplier(values: Record<string, unknown> | undefined): number {
  if (!values) return 1;
  let mult = 1;
  const durKey = ["duration", "num_seconds", "seconds", "video_length"].find((k) => k in values);
  if (durKey) { const d = numVal(values[durKey]); if (d && d > 0) mult *= d / 5; }
  const cKey = ["num_images", "image_count", "n", "num_outputs", "batch_size"].find((k) => k in values);
  if (cKey) { const c = numVal(values[cKey]); if (c && c > 0) mult *= c; }
  const rKey = ["resolution", "size", "video_resolution"].find((k) => k in values);
  if (rKey) mult *= resolutionMultiplier(values[rKey]);
  const fKey = ["num_frames", "frames"].find((k) => k in values);
  if (fKey) { const f = numVal(values[fKey]); if (f && f > 0) mult *= f / 81; }
  const sKey = ["num_inference_steps", "steps"].find((k) => k in values);
  if (sKey) { const s = numVal(values[sKey]); if (s && s > 30) mult *= s / 30; }
  return Math.max(0.25, Math.min(mult, 20));
}

async function updateProviderHealth(supabase: any, healthy: boolean, latencyMs: number | null, error?: string) {
  await supabase.from("app_settings").upsert({
    key: "provider_health",
    value: { healthy, checked_at: new Date().toISOString(), latency_ms: latencyMs, error: error || null },
  }, { onConflict: "key" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = getEnv("WAVESPEED_API_KEY");
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const action = body.action as string;

    // ========= HEALTH CHECK =========
    if (action === "health") {
      const t0 = Date.now();
      try {
        const res = await fetch(`${WAVESPEED_BASE}/predictions/__healthcheck__/result`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        // Cualquier respuesta HTTP (incluso 404) significa que el proveedor está vivo
        const latency = Date.now() - t0;
        const healthy = res.status < 500;
        await updateProviderHealth(supabase, healthy, latency);
        log("info", "health_check", { healthy, latency_ms: latency, status: res.status });
        return json({ code: 0, data: { healthy, latency_ms: latency } });
      } catch (e) {
        const latency = Date.now() - t0;
        await updateProviderHealth(supabase, false, latency, errMsg(e));
        log("warn", "health_check_failed", { latency_ms: latency, error: errMsg(e) });
        return json({ code: 0, data: { healthy: false, latency_ms: latency } });
      }
    }

    // ========= SUBMIT =========
    if (action === "submit") {
      const { type, modelPath, modelLabel, prompt, payload, userId, basePrice } = body;

      if (!modelPath || !prompt) return json({ error: "modelPath y prompt requeridos" }, 400);
      if (!userId) return json({ error: "userId requerido" }, 401);

      // Rate limiting por usuario
      const { data: allowed, error: rlErr } = await supabase.rpc("check_and_increment_rate_limit", {
        _user_id: userId,
        _max_per_minute: RATE_LIMIT_PER_MINUTE,
      });
      if (rlErr) {
        log("error", "rate_limit_check_failed", { userId, error: rlErr.message });
      } else if (allowed === false) {
        log("warn", "rate_limit_blocked", { userId, limit: RATE_LIMIT_PER_MINUTE });
        return json({ code: 3, message: `Demasiadas generaciones. Esperá un minuto antes de intentar de nuevo.` });
      }

      const { markup, creditsPerUsd, mpFeePct } = await getPricingSettings(supabase);

      // Check si el usuario es admin → no se descuentan créditos (uso libre interno)
      const { data: isAdminUser } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      const dynMult = dynamicMultiplier(payload);
      const effectivePrice = (Number(basePrice) || 0) * dynMult;
      const cost = computeCost(effectivePrice, markup, creditsPerUsd, mpFeePct);
      const adminCostInfo = Math.max(1, Math.ceil(effectivePrice * creditsPerUsd));
      log("info", "cost_calc", { basePrice, dynMult, effectivePrice, cost });

      if (isAdminUser) {
        log("info", "admin_free_generation", { userId, basePrice, adminCostInfo, modelPath });
      } else {
        // Débito atómico (solo usuarios no-admin)
        const { error: debitErr } = await supabase.rpc("debit_credits_for_user", {
          _user_id: userId,
          _amount: cost,
          _reason: `Generación: ${modelLabel || modelPath}`,
        });
        if (debitErr) {
          if (debitErr.message?.includes("insufficient_credits")) {
            log("info", "debit_insufficient", { userId, cost });
            return json({ code: 2, message: `Saldo insuficiente. Necesitás ${cost} créditos.` });
          }
          log("error", "debit_failed", { userId, cost, error: debitErr.message });
          throw new Error(`DB debit: ${debitErr.message}`);
        }
        log("info", "debit_ok", { userId, cost, modelPath });
      }

      const refund = async (reason: string) => {
        if (isAdminUser) return; // admins no pagaron, no hay nada que devolver
        const { error: rErr } = await supabase.rpc("refund_credits_for_user", {
          _user_id: userId, _amount: cost, _reason: reason, _generation_id: null,
        });
        if (rErr) log("error", "refund_failed", { userId, cost, error: rErr.message });
        else log("info", "refund_ok", { userId, cost, reason });
      };

      // Llamar proveedor
      let ws: any;
      try {
        ws = await callWaveSpeed(modelPath, payload || { prompt }, apiKey);
        // Marcar healthy en éxito
        updateProviderHealth(supabase, true, null).catch(() => {});
      } catch (e: any) {
        await refund(`Reembolso (error proveedor): ${modelLabel || modelPath}`);
        // Marcar unhealthy si fue 5xx o timeout
        if (!e.providerStatus || e.providerStatus >= 500) {
          updateProviderHealth(supabase, false, null, errMsg(e)).catch(() => {});
        }
        log("error", "provider_submit_failed", { userId, modelPath, error: errMsg(e), status: e.providerStatus });
        // A los admins les mostramos el error técnico real para poder debuggear.
        const adminMsg = isAdminUser
          ? `Proveedor ${e.providerStatus || ""}: ${errMsg(e)}`.trim()
          : (e.userMessage || GENERIC_PROVIDER_ERROR);
        return json({ code: 1, message: adminMsg });
      }

      const taskId = ws?.data?.id || ws?.id;
      if (!taskId) {
        await refund(`Reembolso (sin task_id): ${modelLabel || modelPath}`);
        log("error", "provider_no_taskid", { userId, modelPath, response: ws });
        const adminMsg = isAdminUser
          ? `Proveedor sin task_id: ${JSON.stringify(ws).slice(0, 300)}`
          : GENERIC_PROVIDER_ERROR;
        return json({ code: 1, message: adminMsg });
      }

      const { data: gen, error } = await supabase
        .from("generations")
        .insert({
          type,
          prompt,
          user_id: userId,
          model: modelLabel || modelPath,
          aspect_ratio: payload?.aspect_ratio || payload?.size || null,
          duration: payload?.duration ? String(payload.duration) : null,
          negative_prompt: payload?.negative_prompt || null,
          reference_image_url: payload?.image || payload?.image_url || null,
          task_id: taskId,
          status: "processing",
          parameters: { modelPath, basePrice, costCredits: cost, ...payload, user_id: userId },
        })
        .select()
        .single();

      if (error) {
        await refund(`Reembolso (error DB): ${modelLabel || modelPath}`);
        log("error", "db_insert_failed", { userId, error: error.message });
        throw new Error(`DB: ${error.message}`);
      }

      // Vincular generation_id a la última transacción de débito
      await supabase
        .from("credit_transactions")
        .update({ generation_id: gen.id })
        .eq("user_id", userId)
        .is("generation_id", null)
        .eq("type", "debit")
        .order("created_at", { ascending: false })
        .limit(1);

      log("info", "generation_submitted", { userId, generationId: gen.id, taskId, cost, modelPath });
      return json({ code: 0, data: { id: gen.id, task_id: taskId, cost } });
    }

    // ========= POLL =========
    if (action === "poll") {
      const { generation_id } = body;
      if (!generation_id) return json({ error: "generation_id requerido" }, 400);

      const { data: gen, error: ge } = await supabase
        .from("generations").select("*").eq("id", generation_id).single();
      if (ge || !gen) throw new Error("Generación no encontrada");

      if (gen.status === "completed" || gen.status === "failed") {
        return json({ code: 0, data: { status: gen.status, urls: gen.result_urls, error: gen.error_message } });
      }
      if (!gen.task_id) return json({ code: 0, data: { status: gen.status } });

      const result = await pollWaveSpeed(gen.task_id, apiKey);
      const d = result?.data || result;
      const status = d?.status;
      const outputs: string[] = d?.outputs || [];
      const errorTxt: string | undefined = d?.error;

      if (status === "completed") {
        await supabase.from("generations").update({ status: "completed", result_urls: outputs }).eq("id", generation_id);
        log("info", "generation_completed", { generationId: generation_id });
        return json({ code: 0, data: { status: "completed", urls: outputs } });
      }
      if (status === "failed") {
        await supabase.from("generations")
          .update({ status: "failed", error_message: errorTxt || "provider failed" })
          .eq("id", generation_id);

        const userId = gen.user_id || gen.parameters?.user_id;
        const cost = gen.parameters?.costCredits;
        if (userId && cost) {
          await supabase.rpc("refund_credits_for_user", {
            _user_id: userId, _amount: cost,
            _reason: `Reembolso por fallo: ${gen.model}`,
            _generation_id: gen.id,
          });
          log("info", "refund_on_fail", { userId, cost, generationId: gen.id });
        }
        log("warn", "generation_failed", { generationId: generation_id, error: errorTxt });
        // Mensaje neutro al usuario
        return json({ code: 0, data: { status: "failed", error: GENERIC_PROVIDER_ERROR } });
      }
      return json({ code: 0, data: { status: "processing" } });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    log("error", "wavespeed_generate_unhandled", { error: errMsg(e) });
    return json({ code: 1, message: GENERIC_PROVIDER_ERROR }, 200);
  }
});
