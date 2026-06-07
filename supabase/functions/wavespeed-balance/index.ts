import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded + "===".slice((padded.length + 3) % 4));
    const claims = JSON.parse(json);
    if (claims?.exp && Date.now() / 1000 > claims.exp) return null;
    return typeof claims?.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  console.log(`Request received: ${req.method} ${new URL(req.url).pathname}`);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    // Si no hay token en el header, intentamos sacarlo de apikey (caso de invocación directa desde el cliente de Supabase)
    const apiKeyHeader = req.headers.get("apikey") || "";
    
    let userId: string | null = decodeJwtSub(token);
    
    // Si sigue siendo null, intentamos decodificar el apikey si parece un JWT
    if (!userId && apiKeyHeader.includes(".")) {
      userId = decodeJwtSub(apiKeyHeader);
    }

    if (!userId) {
      console.error("Auth failed. Headers keys:", Object.keys(Object.fromEntries(req.headers.entries())));
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    console.log("Checking admin status for:", userId);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Database error checking role:", roleError);
      return jsonResponse({ error: "Error de base de datos" }, 500);
    }

    if (!roleData) {
      console.error("User is NOT an admin:", userId);
      return jsonResponse({ error: "No autorizado" }, 403);
    }

    const wsKey = Deno.env.get("WAVESPEED_API_KEY");
    if (!wsKey) {
      console.error("WAVESPEED_API_KEY missing");
      return jsonResponse({ error: "Configuración incompleta" }, 500);
    }

    console.log("Fetching balance from WaveSpeed...");
    const res = await fetch("https://api.wavespeed.ai/api/v3/balance", {
      headers: { Authorization: `Bearer ${wsKey}` },
    });
    
    const data = await res.json();
    console.log("WaveSpeed response status:", res.status);

    if (!res.ok) {
      return jsonResponse({ error: data?.message || `Error de WaveSpeed: ${res.status}` }, res.status);
    }

    return jsonResponse({ balance_usd: data?.data?.balance ?? 0 });
  } catch (e) {
    console.error("Unexpected error:", e);
    return jsonResponse({ error: "Error interno" }, 500);
  }
});
