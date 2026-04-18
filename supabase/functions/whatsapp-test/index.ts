// Envía un mensaje de prueba por Evolution API al número configurado.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const NOTIFY_TO = "59893867429";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const baseUrl = Deno.env.get("EVOLUTION_API_URL");
  const instance = Deno.env.get("EVOLUTION_INSTANCE");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY");
  if (!baseUrl || !instance || !apiKey) {
    return new Response(JSON.stringify({ ok: false, error: "Evolution no configurada" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let customText: string | undefined;
  try { const b = await req.json(); if (typeof b?.text === "string") customText = b.text; } catch (_) {}

  const text = customText ||
    `🧪 *Test desde Lovable*\nIntegración con Evolution API funcionando.\n${new Date().toLocaleString("es-UY")}`;

  const url = `${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: NOTIFY_TO, text }),
  });
  const body = await res.text();
  return new Response(JSON.stringify({ ok: res.ok, status: res.status, response: body }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
