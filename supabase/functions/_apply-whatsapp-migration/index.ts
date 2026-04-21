import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try add column via PostgREST (works only if exec rpc exists). Fallback: use raw fetch to SQL via pg_meta is not possible from edge.
    // Instead, perform a no-op UPDATE — if column missing, error tells us. This function exists only to trigger the migration runner via Lovable.
    const { error } = await supabase.from("profiles").select("whatsapp").limit(1);
    return new Response(
      JSON.stringify({ ok: !error, error: error?.message ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});