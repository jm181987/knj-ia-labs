import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return "Unknown error"; }
}

async function callGemini(model: string, payload: unknown) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY no configurada");

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* */ }

  if (!res.ok) {
    const msg = data?.error?.message || `Gemini error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Map our friendly model ids -> real Gemini model ids
const MODEL_MAP: Record<string, string> = {
  "gemini-2.5-flash-image": "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview": "gemini-3-pro-image-preview",
  // Fallback aliases used by the UI
  "google/gemini-2.5-flash-image": "gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview": "gemini-3-pro-image-preview",
  "google/gemini-3.1-flash-image-preview": "gemini-3-pro-image-preview",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body?.action as string;

    // === Generate image ===
    if (action === "generate-image") {
      const { prompt, model = "gemini-2.5-flash-image", image_count = 1, aspect_ratio = "1:1" } = body;
      if (!prompt) return jsonResponse({ code: -1, message: "Falta prompt" }, 400);

      const realModel = MODEL_MAP[model] || "gemini-2.5-flash-image";
      const supabase = getSupabase();
      const urls: string[] = [];

      for (let i = 0; i < Math.min(image_count, 4); i++) {
        const data = await callGemini(realModel, {
          contents: [{
            parts: [{ text: `${prompt}${aspect_ratio !== "1:1" ? ` (aspect ratio ${aspect_ratio})` : ""}` }],
          }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        });

        const parts = data?.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          if (p.inlineData?.data) {
            const mime = p.inlineData.mimeType || "image/png";
            urls.push(`data:${mime};base64,${p.inlineData.data}`);
            break;
          }
        }
      }

      if (urls.length === 0) throw new Error("Gemini no devolvió imágenes");

      const { data: row, error } = await supabase.from("generations").insert({
        type: "image",
        prompt,
        model,
        aspect_ratio,
        image_count: urls.length,
        status: "completed",
        result_urls: urls,
        parameters: { provider: "gemini-direct", model, aspect_ratio },
      }).select().single();
      if (error) throw new Error(`DB: ${error.message}`);

      return jsonResponse({ code: 0, data: { generation: row, result_urls: urls } });
    }

    // === Improve prompt ===
    if (action === "improve-prompt") {
      const { prompt, type = "image" } = body;
      if (!prompt) return jsonResponse({ code: -1, message: "Falta prompt" }, 400);

      const sys = `Eres un experto en escribir prompts para modelos de IA generativa de ${type === "video" ? "video (Kling, Veo)" : "imagen (Nano Banana, Kling)"}. Reescribe el prompt del usuario en inglés, añadiendo detalles cinematográficos, iluminación, composición, estilo visual y calidad. Devuelve SOLO el prompt mejorado, sin comentarios ni comillas.`;

      const data = await callGemini("gemini-2.5-flash", {
        contents: [{ parts: [{ text: `${sys}\n\nPrompt original:\n${prompt}` }] }],
      });
      const improved = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || prompt;
      return jsonResponse({ code: 0, data: { prompt: improved } });
    }

    // === Describe image ===
    if (action === "describe-image") {
      const { image_url } = body;
      if (!image_url) return jsonResponse({ code: -1, message: "Falta image_url" }, 400);

      // Download image and convert to base64 for Gemini inline
      const imgRes = await fetch(image_url);
      if (!imgRes.ok) throw new Error("No se pudo descargar la imagen de referencia");
      const mime = imgRes.headers.get("content-type") || "image/jpeg";
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
      const b64 = btoa(binary);

      const data = await callGemini("gemini-2.5-flash", {
        contents: [{
          parts: [
            { text: "Describe esta imagen como un prompt detallado en inglés para un modelo de generación de video/imagen IA. Incluye sujeto, estilo, iluminación, composición, ambiente. Devuelve SOLO el prompt." },
            { inlineData: { mimeType: mime, data: b64 } },
          ],
        }],
      });
      const desc = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      return jsonResponse({ code: 0, data: { prompt: desc } });
    }

    return jsonResponse({ code: -1, message: "Acción desconocida" }, 400);
  } catch (e) {
    console.error("gemini-direct error:", e);
    return jsonResponse({ code: -1, message: getErr(e) }, 500);
  }
});
