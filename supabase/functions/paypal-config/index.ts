const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const id = Deno.env.get("PAYPAL_CLIENT_ID") || "";
  return new Response(JSON.stringify({ client_id: id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});