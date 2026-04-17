import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error); } catch { return "Unknown error"; }
}

async function callAI(body: Record<string, unknown>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new Error("Límite de uso alcanzado, intenta en un momento.");
  if (res.status === 402) throw new Error("Sin créditos en Lovable AI. Agrega fondos en Settings → Workspace → Usage.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${t}`);
  }
  return await res.json();
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body?.action as string;

    // === Generate image with Nano Banana ===
    if (action === "generate-image") {
      const { prompt, model = "google/gemini-2.5-flash-image", image_count = 1, aspect_ratio = "1:1" } = body;
      if (!prompt) return jsonResponse({ code: -1, message: "Falta prompt" }, 400);

      const supabase = getSupabase();
      const urls: string[] = [];

      // Lovable AI no soporta n>1 nativo; iteramos
      for (let i = 0; i < Math.min(image_count, 4); i++) {
        const data = await callAI({
          model,
          messages: [{
            role: "user",
            content: `${prompt}${aspect_ratio !== "1:1" ? ` (aspect ratio ${aspect_ratio})` : ""}`,
          }],
          modalities: ["image", "text"],
        });
        const imgUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imgUrl) urls.push(imgUrl);
      }

      if (urls.length === 0) throw new Error("La IA no devolvió imágenes");

      const { data: row, error } = await supabase.from("generations").insert({
        type: "image",
        prompt,
        model,
        aspect_ratio,
        image_count: urls.length,
        status: "completed",
        result_urls: urls,
        parameters: { provider: "lovable-ai", model, aspect_ratio },
      }).select().single();
      if (error) throw new Error(`DB: ${error.message}`);

      return jsonResponse({ code: 0, data: { generation: row, result_urls: urls } });
    }

    // === Improve prompt ===
    if (action === "improve-prompt") {
      const { prompt, type = "image" } = body;
      if (!prompt) return jsonResponse({ code: -1, message: "Falta prompt" }, 400);

      const data = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Eres un experto en escribir prompts para modelos de IA generativa de ${type === "video" ? "video (Kling, Veo)" : "imagen (Nano Banana, Kling)"}. Reescribe el prompt del usuario en inglés, añadiendo detalles cinematográficos, iluminación, composición, estilo visual y calidad. Devuelve SOLO el prompt mejorado, sin comentarios ni comillas.`,
          },
          { role: "user", content: prompt },
        ],
      });
      const improved = data?.choices?.[0]?.message?.content?.trim() || prompt;
      return jsonResponse({ code: 0, data: { prompt: improved } });
    }

    // === Describe reference image ===
    if (action === "describe-image") {
      const { image_url } = body;
      if (!image_url) return jsonResponse({ code: -1, message: "Falta image_url" }, 400);

      const data = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Describe esta imagen como un prompt detallado en inglés para un modelo de generación de video/imagen IA. Incluye sujeto, estilo, iluminación, composición, ambiente. Devuelve SOLO el prompt." },
            { type: "image_url", image_url: { url: image_url } },
          ],
        }],
      });
      const desc = data?.choices?.[0]?.message?.content?.trim() || "";
      return jsonResponse({ code: 0, data: { prompt: desc } });
    }

    return jsonResponse({ code: -1, message: "Acción desconocida" }, 400);
  } catch (error) {
    console.error("lovable-ai error:", error);
    return jsonResponse({ code: -1, message: getErrorMessage(error) }, 500);
  }
});
