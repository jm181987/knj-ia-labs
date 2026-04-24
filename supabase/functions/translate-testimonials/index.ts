import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Row {
  id: string;
  message: string;
  role: string | null;
  message_en: string | null;
  message_pt: string | null;
  role_en: string | null;
  role_pt: string | null;
}

async function translate(text: string, lang: "en" | "pt"): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const target = lang === "en" ? "English" : "Brazilian Portuguese";
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            `You are a professional translator. Translate the user's text to ${target}. ` +
            `Preserve tone, punctuation and emojis. Do NOT add quotes, prefixes or explanations. ` +
            `Return only the translated text.`,
        },
        { role: "user", content: text },
      ],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const onlyId: string | undefined = body?.id;
    const force: boolean = !!body?.force;

    let query = supabase
      .from("testimonials")
      .select("id,message,role,message_en,message_pt,role_en,role_pt");
    if (onlyId) query = query.eq("id", onlyId);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as Row[];
    let updated = 0;

    for (const r of rows) {
      const patch: Record<string, string> = {};
      const needs = (val: string | null) => force || !val || !val.trim();

      if (r.message && needs(r.message_en)) {
        patch.message_en = await translate(r.message, "en");
      }
      if (r.message && needs(r.message_pt)) {
        patch.message_pt = await translate(r.message, "pt");
      }
      if (r.role && needs(r.role_en)) {
        patch.role_en = await translate(r.role, "en");
      }
      if (r.role && needs(r.role_pt)) {
        patch.role_pt = await translate(r.role, "pt");
      }

      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabase
          .from("testimonials")
          .update(patch)
          .eq("id", r.id);
        if (upErr) throw upErr;
        updated++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: rows.length, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("translate-testimonials error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});