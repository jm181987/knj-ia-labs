const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_TO = "59893867429";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, whatsapp, display_name } = await req.json();

    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const instance = Deno.env.get("EVOLUTION_INSTANCE");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!baseUrl || !instance || !apiKey) {
      console.warn("Evolution API no configurada");
      return new Response(JSON.stringify({ ok: false, error: "not_configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text =
      `🆕 *Nuevo registro en KNJ PRO*\n` +
      `Nombre: ${display_name || "—"}\n` +
      `Email: ${email || "—"}\n` +
      `WhatsApp: ${whatsapp || "—"}\n` +
      `${new Date().toLocaleString("es-UY")}`;

    const url = `${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: NOTIFY_TO, text }),
    });
    const body = await res.text();
    if (!res.ok) console.error("Evolution send failed", res.status, body);

    return new Response(JSON.stringify({ ok: res.ok }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-new-user error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});