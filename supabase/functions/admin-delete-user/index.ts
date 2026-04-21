// Edge function: admin-delete-user
// Elimina un usuario completamente (auth + datos relacionados via cascade).
// Usa service role key. Verifica que el caller sea admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROTECTED_ADMIN_ID = "6aabbe63-2a25-4eff-b16a-1f6ca663b00a"; // super admin

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id } = await req.json();
    if (!user_id || typeof user_id !== "string") {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === PROTECTED_ADMIN_ID) {
      return new Response(JSON.stringify({ error: "Este usuario es super admin y no puede ser eliminado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (user_id === userData.user.id) {
      return new Response(JSON.stringify({ error: "No podés eliminar tu propia cuenta." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Borrar datos relacionados (las FKs no están definidas, hay que limpiar a mano)
    await adminClient.from("credit_transactions").delete().eq("user_id", user_id);
    await adminClient.from("user_credits").delete().eq("user_id", user_id);
    await adminClient.from("user_roles").delete().eq("user_id", user_id);
    await adminClient.from("generations").delete().eq("user_id", user_id);
    await adminClient.from("payments").delete().eq("user_id", user_id);
    await adminClient.from("subscriptions").delete().eq("user_id", user_id);
    await adminClient.from("rate_limits").delete().eq("user_id", user_id);
    await adminClient.from("profiles").delete().eq("id", user_id);

    // Borrar de auth.users
    const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});