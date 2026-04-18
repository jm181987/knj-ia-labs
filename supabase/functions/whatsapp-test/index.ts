// Diagnóstico: prueba varias variantes de auth contra Evolution API.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const NOTIFY_TO = "59893867429";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const baseUrl = Deno.env.get("EVOLUTION_API_URL")!;
  const instance = Deno.env.get("EVOLUTION_INSTANCE")!;
  const apiKey = Deno.env.get("EVOLUTION_API_KEY")!;
  const url = `${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`;
  const text = `🧪 Test variante`;

  const variants = [
    { name: "apikey lower", headers: { "Content-Type": "application/json", apikey: apiKey } },
    { name: "Apikey capital", headers: { "Content-Type": "application/json", Apikey: apiKey } },
    { name: "APIKEY upper", headers: { "Content-Type": "application/json", APIKEY: apiKey } },
    { name: "Authorization Bearer", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` } },
    { name: "x-api-key", headers: { "Content-Type": "application/json", "x-api-key": apiKey } },
  ];

  // También probamos /instance/fetchInstances que requiere global API key
  const fetchInstancesUrl = `${baseUrl.replace(/\/$/, "")}/instance/fetchInstances`;

  const results: any[] = [];
  for (const v of variants) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: v.headers,
        body: JSON.stringify({ number: NOTIFY_TO, text }),
      });
      const body = await r.text();
      results.push({ test: v.name, status: r.status, body: body.slice(0, 200) });
    } catch (e) {
      results.push({ test: v.name, error: String(e) });
    }
  }

  // Probar fetchInstances (requiere global key)
  try {
    const r = await fetch(fetchInstancesUrl, { headers: { apikey: apiKey } });
    const body = await r.text();
    results.push({ test: "fetchInstances apikey", status: r.status, body: body.slice(0, 300) });
  } catch (e) {
    results.push({ test: "fetchInstances", error: String(e) });
  }

  return new Response(JSON.stringify({ url, instance, keyLen: apiKey.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
