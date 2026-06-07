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
    // Auth: solo admins
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      console.error("Missing Bearer token");
      return jsonResponse({ error: "No autenticado" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const userId = decodeJwtSub(token);
    if (!userId) {
      console.error("Invalid JWT or sub claim missing");
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    // Simplificamos la verificación de admin a una query directa por si rpc falla
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Admin check failed for user:", userId, "Error:", roleError);
      return jsonResponse({ error: "No autorizado" }, 403);
    }

    const apiKey = Deno.env.get("WAVESPEED_API_KEY");
    if (!apiKey) {
      console.error("WAVESPEED_API_KEY is not defined in env");
      return jsonResponse({ error: "WAVESPEED_API_KEY no configurada" }, 500);
    }

    const res = await fetch("https://api.wavespeed.ai/api/v3/balance", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return jsonResponse({ error: data?.message || `WaveSpeed error ${res.status}` }, res.status);
    }
    return jsonResponse({ balance_usd: data?.data?.balance ?? null, raw: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
