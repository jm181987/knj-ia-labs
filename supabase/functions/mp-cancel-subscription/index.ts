import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "No autenticado" }, 401);
    const callerId = userData.user.id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificar que es admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return jsonResponse({ error: "Solo admins" }, 403);

    const { subscription_id } = await req.json();
    if (!subscription_id) return jsonResponse({ error: "subscription_id requerido" }, 400);

    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscription_id)
      .maybeSingle();
    if (subErr || !sub) return jsonResponse({ error: "Suscripción no encontrada" }, 404);
    if (!sub.mp_preapproval_id) return jsonResponse({ error: "Sin mp_preapproval_id" }, 400);

    // Cancelar en Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP cancel error:", mpData);
      throw new Error(`MP: ${mpData.message || JSON.stringify(mpData)}`);
    }

    await supabase
      .from("subscriptions")
      .update({
        status: "cancelled",
        mp_response: mpData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription_id);

    return jsonResponse({ ok: true, status: "cancelled" });
  } catch (e) {
    console.error("mp-cancel-subscription error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
