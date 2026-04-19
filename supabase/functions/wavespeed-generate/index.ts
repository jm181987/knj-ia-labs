import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";

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

async function callWaveSpeed(modelPath: string, payload: Record<string, unknown>, apiKey: string) {
  const url = `${WAVESPEED_BASE}/${modelPath.replace(/^\/+/, "")}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `WaveSpeed error ${res.status}`;
    throw new Error(msg);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = getEnv("WAVESPEED_API_KEY");
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const action = body.action as string;

    // ========= SUBMIT =========
    if (action === "submit") {
      const {
        type,
        modelPath,
        modelLabel,
        prompt,
        payload,
        userId,
        basePrice, // USD del catálogo
      } = body;

      if (!modelPath || !prompt) return json({ error: "modelPath y prompt requeridos" }, 400);
      if (!userId) return json({ error: "userId requerido" }, 401);

      // Calcular costo en créditos
      const { markup, creditsPerUsd, mpFeePct } = await getPricingSettings(supabase);
      const cost = computeCost(Number(basePrice) || 0, markup, creditsPerUsd, mpFeePct);

      // Débito ATÓMICO de créditos via función Postgres (evita race conditions)
      const { error: debitErr } = await supabase.rpc("debit_credits_for_user", {
        _user_id: userId,
        _amount: cost,
        _reason: `Generación: ${modelLabel || modelPath}`,
      });
      if (debitErr) {
        if (debitErr.message?.includes("insufficient_credits")) {
          return json({ code: 2, message: `Saldo insuficiente. Necesitás ${cost} créditos.` });
        }
        throw new Error(`DB debit: ${debitErr.message}`);
      }

      const refund = async (reason: string) => {
        await supabase.rpc("refund_credits_for_user", {
          _user_id: userId,
          _amount: cost,
          _reason: reason,
          _generation_id: null,
        });
      };

      // Llamar WaveSpeed
      let ws: any;
      try {
        ws = await callWaveSpeed(modelPath, payload || { prompt }, apiKey);
      } catch (e) {
        await refund(`Reembolso (error WaveSpeed): ${modelLabel || modelPath}`);
        throw e;
      }
      const taskId = ws?.data?.id || ws?.id;
      if (!taskId) {
        await refund(`Reembolso (sin task_id): ${modelLabel || modelPath}`);
        throw new Error("WaveSpeed no devolvió task ID");
      }

      // Guardar generación con user_id en columna dedicada
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
        throw new Error(`DB: ${error.message}`);
      }

      // Vincular el generation_id a la última transacción de débito
      await supabase
        .from("credit_transactions")
        .update({ generation_id: gen.id })
        .eq("user_id", userId)
        .is("generation_id", null)
        .eq("type", "debit")
        .order("created_at", { ascending: false })
        .limit(1);

      return json({ code: 0, data: { id: gen.id, task_id: taskId, cost } });
    }

    // ========= POLL =========
    if (action === "poll") {
      const { generation_id } = body;
      if (!generation_id) return json({ error: "generation_id requerido" }, 400);

      const { data: gen, error: ge } = await supabase
        .from("generations")
        .select("*")
        .eq("id", generation_id)
        .single();
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
        await supabase
          .from("generations")
          .update({ status: "completed", result_urls: outputs })
          .eq("id", generation_id);
        return json({ code: 0, data: { status: "completed", urls: outputs } });
      }
      if (status === "failed") {
        await supabase
          .from("generations")
          .update({ status: "failed", error_message: errorTxt || "WaveSpeed failed" })
          .eq("id", generation_id);
        // Reembolso por fallo
        const userId = gen.parameters?.user_id;
        const cost = gen.parameters?.costCredits;
        if (userId && cost) {
          const { data: ub } = await supabase.from("user_credits").select("balance").eq("user_id", userId).maybeSingle();
          if (ub) {
            await supabase
              .from("user_credits")
              .update({ balance: (ub.balance || 0) + cost, updated_at: new Date().toISOString() })
              .eq("user_id", userId);
            await supabase.from("credit_transactions").insert({
              user_id: userId,
              amount: cost,
              reason: `Reembolso por fallo: ${gen.model}`,
              type: "credit",
              generation_id: gen.id,
            });
          }
        }
        return json({ code: 0, data: { status: "failed", error: errorTxt } });
      }
      return json({ code: 0, data: { status: "processing" } });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    console.error("wavespeed-generate error:", e);
    return json({ code: 1, message: errMsg(e) }, 200);
  }
});
