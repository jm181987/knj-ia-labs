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
    // Fallback al endpoint sin /result (algunas variantes)
    const r2 = await fetch(`${WAVESPEED_BASE}/predictions/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    const d2 = await r2.json().catch(() => ({}));
    if (!r2.ok) throw new Error(d2?.message || `Polling error ${r2.status}`);
    return d2;
  }
  return data;
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
        type,           // "video" | "image"
        modelPath,      // ej "bytedance/seedance-v1-pro-t2v-480p"
        modelLabel,     // ej "Seedance 2.0"
        prompt,
        payload,        // payload completo para WaveSpeed
        userId,
      } = body;

      if (!modelPath || !prompt) return json({ error: "modelPath y prompt requeridos" }, 400);

      // Llamar WaveSpeed
      const ws = await callWaveSpeed(modelPath, payload || { prompt }, apiKey);
      const taskId = ws?.data?.id || ws?.id;
      if (!taskId) throw new Error("WaveSpeed no devolvió task ID");

      // Guardar en DB
      const { data: gen, error } = await supabase
        .from("generations")
        .insert({
          type,
          prompt,
          model: modelLabel || modelPath,
          aspect_ratio: payload?.aspect_ratio || payload?.size || null,
          duration: payload?.duration ? String(payload.duration) : null,
          negative_prompt: payload?.negative_prompt || null,
          reference_image_url: payload?.image || payload?.image_url || null,
          task_id: taskId,
          status: "processing",
          parameters: { modelPath, ...payload, user_id: userId },
        })
        .select()
        .single();

      if (error) throw new Error(`DB: ${error.message}`);

      return json({ code: 0, data: { id: gen.id, task_id: taskId } });
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
      const status = d?.status; // created | processing | completed | failed
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
