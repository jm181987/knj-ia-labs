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
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Faltan EVOLUTION_API_URL, EVOLUTION_INSTANCE o EVOLUTION_API_KEY",
        haveUrl: !!baseUrl, haveInstance: !!instance, haveKey: !!apiKey,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let customText: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.text === "string") customText = body.text;
  } catch (_) { /* sin body */ }

  const text =
    customText ||
    `🧪 *Test desde Lovable*\nSi ves este mensaje, la integración con Evolution API funciona.\n${new Date().toLocaleString("es-UY")}`;

  const url = `${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: NOTIFY_TO, text }),
  });
  const responseText = await res.text();
  console.log("Evolution response", res.status, responseText);

  return new Response(
    JSON.stringify({ ok: res.ok, status: res.status, response: responseText, url }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
