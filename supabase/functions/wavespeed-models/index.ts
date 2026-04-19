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

    if (CACHE && Date.now() - CACHE.at < TTL_MS) {
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
      // Buscamos URL de demo/cover en varios campos posibles
      const demo_url =
        m.cover_url || m.cover || m.thumbnail_url || m.thumbnail || m.preview_url || m.preview ||
        m.example_url || m.example || m.demo_url || m.demo || m.image_url || m.video_url ||
        sch?.cover_url || sch?.preview_url || sch?.example_url ||
        (Array.isArray(m.examples) && (m.examples[0]?.url || m.examples[0]?.output_url || m.examples[0]?.image || m.examples[0]?.video)) ||
        null;
      return {
        model_id: m.model_id,
        name: m.name,
        type: m.type,
        description: m.description,
        base_price: m.base_price,
        sort_order: m.sort_order,
        request_schema: sch?.request_schema || null,
        api_path: sch?.api_path || null,
        demo_url,
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
