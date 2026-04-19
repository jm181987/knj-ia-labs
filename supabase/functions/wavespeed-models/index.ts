// Lista todos los modelos de Wavespeed con su request_schema completo.
// Cachea en memoria por 30 min para evitar llamadas repetidas.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";
const TTL_MS = 30 * 60 * 1000;

let CACHE: { at: number; data: unknown } | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("WAVESPEED_API_KEY");
    if (!apiKey) return json({ code: 1, message: "WAVESPEED_API_KEY no configurada" }, 200);

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    if (!force && CACHE && Date.now() - CACHE.at < TTL_MS) {
      return json({ code: 0, data: CACHE.data, cached: true });
    }

    const res = await fetch(`${WAVESPEED_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ code: 1, message: raw?.message || `HTTP ${res.status}` }, 200);
    }

    const list = Array.isArray(raw?.data) ? raw.data : [];

    // Compactamos a lo esencial para reducir tamaño de respuesta
    const compact = list.map((m: any) => {
      const sch = m?.api_schema?.api_schemas?.find((s: any) => s.type === "model_run") || m?.api_schema?.api_schemas?.[0];
      return {
        model_id: m.model_id,
        name: m.name,
        type: m.type,
        description: m.description,
        base_price: m.base_price,
        sort_order: m.sort_order,
        request_schema: sch?.request_schema || null,
        api_path: sch?.api_path || null,
      };
    }).filter((m: any) => m.request_schema && m.api_path);

    CACHE = { at: Date.now(), data: compact };
    return json({ code: 0, data: compact, cached: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("wavespeed-models error:", msg);
    return json({ code: 1, message: msg }, 200);
  }
});
