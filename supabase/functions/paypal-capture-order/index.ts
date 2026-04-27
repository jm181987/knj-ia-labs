import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PAYPAL_BASE, getPaypalAccessToken } from "../_shared/paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_TO = "59893867429";
async function notifyWhatsApp(text: string) {
  try {
    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const instance = Deno.env.get("EVOLUTION_INSTANCE");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!baseUrl || !instance || !apiKey) {
      console.warn("Evolution API no configurada, skip WhatsApp");
      return;
    }
    const url = `${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: NOTIFY_TO, text }),
    });
    if (!res.ok) {
      console.error("Evolution send failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("notifyWhatsApp error:", err);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "No autenticado" }, 401);
    const user = userData.user;

    const { paypal_order_id } = await req.json();
    if (!paypal_order_id) return json({ error: "Falta paypal_order_id" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order } = await supabase
      .from("payments")
      .select("*")
      .eq("mp_preference_id", paypal_order_id)
      .maybeSingle();
    if (!order) return json({ error: "Orden no encontrada" }, 404);
    if (order.user_id !== user.id) return json({ error: "Forbidden" }, 403);

    if (order.status === "approved") {
      return json({ status: "approved", credits: order.credits, already: true });
    }

    const token = await getPaypalAccessToken();
    const capRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypal_order_id}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const capData = await capRes.json();
    const capStatus = capData?.status;

    if (!capRes.ok || capStatus !== "COMPLETED") {
      console.error("PayPal capture failed:", capData);
      await supabase.from("payments").update({
        status: "rejected",
        mp_response: { provider: "paypal", currency: "USD", capture: capData },
      }).eq("id", order.id);
      return json({ error: capData?.message || "Captura falló", details: capData }, 400);
    }

    // Acreditar créditos (idempotente: chequeamos status)
    const { error: creditErr } = await supabase.rpc("add_credits_system", {
      _user_id: order.user_id,
      _amount: order.credits,
      _reason: `PayPal #${paypal_order_id} (${order.credits} créditos)`,
    });
    if (creditErr) {
      console.error("Error acreditando:", creditErr);
      return json({ error: "Capturado pero falló acreditación", details: creditErr.message }, 500);
    }

    await supabase.from("payments").update({
      status: "approved",
      mp_payment_id: capData?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null,
      mp_response: { provider: "paypal", currency: "USD", capture: capData },
      approved_at: new Date().toISOString(),
    }).eq("id", order.id);

    // Notificar a WhatsApp del admin
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("id", order.user_id)
        .maybeSingle();
      const label = prof?.display_name || prof?.email || order.user_id;
      await notifyWhatsApp(
        `✅ *Venta PayPal aprobada*\n` +
        `Usuario: ${label}\n` +
        `Monto: $${order.amount_uyu} UYU (USD original)\n` +
        `Créditos: ${order.credits}\n` +
        `PayPal Order: ${paypal_order_id}`
      );
    } catch (notifyErr) {
      console.error("Notify WhatsApp falló (no bloqueante):", notifyErr);
    }

    return json({ status: "approved", credits: order.credits });
  } catch (e) {
    console.error("paypal-capture-order error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});