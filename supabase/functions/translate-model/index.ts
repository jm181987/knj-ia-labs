// Traduce descripción + labels/descripciones de campos de un modelo al idioma destino.
// Cachea resultados en app_settings (key: `model_tr:{lang}:{model_id}`).
// Usa Lovable AI Gateway (gratis con LOVABLE_API_KEY).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const LANG_NAMES: Record<string, string> = {
  es: "Spanish (Rioplatense, neutral and concise)",
  en: "English",
  pt: "Brazilian Portuguese",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      model_id,
      lang = "es",
      description = "",
      fields = {} as Record<string, { label?: string; description?: string }>,
    } = body || {};

    if (!model_id) return json({ code: 1, message: "model_id required" }, 200);
    if (!LANG_NAMES[lang]) return json({ code: 1, message: "lang not supported" }, 200);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_KEY) return json({ code: 1, message: "LOVABLE_API_KEY missing" }, 200);

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const cacheKey = `model_tr:${lang}:${model_id}`;

    // Cache hit
    const { data: cached } = await supa
      .from("app_settings")
      .select("value")
      .eq("key", cacheKey)
      .maybeSingle();
    if (cached?.value) {
      return json({ code: 0, data: cached.value, cached: true });
    }

    // Si idioma == en y no hay nada que traducir, devolvemos directo
    if (lang === "en") {
      const passthrough = {
        description,
        field_labels: Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [k, (v as any)?.label || k]),
        ),
        field_descriptions: Object.fromEntries(
          Object.entries(fields).map(([k, v]) => [k, (v as any)?.description || ""]),
        ),
      };
      await supa.from("app_settings").upsert({ key: cacheKey, value: passthrough });
      return json({ code: 0, data: passthrough, cached: false });
    }

    const fieldList = Object.entries(fields).map(([k, v]) => ({
      key: k,
      original_label: (v as any)?.label || k,
      original_description: (v as any)?.description || "",
    }));

    const sysPrompt = `You translate AI model UI strings into ${LANG_NAMES[lang]}.
Rules:
- Translate ONLY natural-language content. Keep technical terms (prompt, seed, CFG, LoRA, IDs) unchanged when there is no good equivalent.
- Keep translations concise and user-friendly.
- For "label", produce a short noun phrase (2-4 words) suitable as a form label, capitalized like a UI title.
- For "description", produce one short helpful sentence.
- Never invent fields. Return exactly the requested keys.`;

    const userPrompt = JSON.stringify({
      model_description: description,
      fields: fieldList,
    });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_translations",
              description: "Return translated description and per-field translations",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        label: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["key", "label", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["description", "fields"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_translations" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI error", aiResp.status, txt);
      if (aiResp.status === 429) return json({ code: 1, message: "rate_limited" }, 200);
      if (aiResp.status === 402) return json({ code: 1, message: "credits_exhausted" }, 200);
      return json({ code: 1, message: `AI ${aiResp.status}` }, 200);
    }

    const aiData = await aiResp.json();
    const call = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json({ code: 1, message: "no tool_call" }, 200);
    let parsed: any;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      return json({ code: 1, message: "invalid AI JSON" }, 200);
    }

    const result = {
      description: parsed.description || description,
      field_labels: Object.fromEntries(
        (parsed.fields || []).map((f: any) => [f.key, f.label]),
      ),
      field_descriptions: Object.fromEntries(
        (parsed.fields || []).map((f: any) => [f.key, f.description]),
      ),
    };

    await supa.from("app_settings").upsert({ key: cacheKey, value: result });
    return json({ code: 0, data: result, cached: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("translate-model error:", msg);
    return json({ code: 1, message: msg }, 200);
  }
});
