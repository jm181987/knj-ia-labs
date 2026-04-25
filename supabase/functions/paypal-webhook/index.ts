import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PAYPAL_BASE, getPaypalAccessToken } from "../_shared/paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo",
};

const NOTIFY_TO = "59893867429";
async function notifyWhatsApp(text: string) {
  try {
    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const instance = Deno.env.get("EVOLUTION_INSTANCE");
    const apiKey = Deno.env.get("EVOLUTION_API_KEY");
    if (!baseUrl || !instance || !apiKey) return;
    await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: NOTIFY_TO, text }),
    });
  } catch (err) { console.error("notifyWhatsApp", err); }
}

async function verifyWebhook(headers: Headers, body: any, webhookId: string): Promise<boolean> {
  if (!webhookId) {
    console.warn("paypal_webhook_id no configurado, skipping verification");
    return true;
  }
  try {
    const token = await getPaypalAccessToken();
    const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: body,
      }),
    });
    const data = await res.json();
    return data.verification_status === "SUCCESS";
  } catch (e) {
    console.error("verify error", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const event = await req.json();
    console.log("PayPal webhook event:", event.event_type, event.id);

    const { data: whSet } = await supabase.from("app_settings").select("value").eq("key", "paypal_webhook_id").maybeSingle();
    const webhookId = (whSet?.value || "").toString().replace(/^"|"$/g, "");

    const verified = await verifyWebhook(req.headers, event, webhookId);
    if (!verified) {
      console.warn("Webhook verification failed");
      return new Response("invalid", { status: 401, headers: corsHeaders });
    }

    const eventType = event.event_type as string;
    const resource = event.resource || {};

    // ===== Pago único (orden) =====
    if (eventType === "CHECKOUT.ORDER.APPROVED" || eventType === "PAYMENT.CAPTURE.COMPLETED") {
      // Para CAPTURE.COMPLETED el resource es el capture. Buscamos via supplementary_data o custom_id
      let paypalOrderId =
        resource.supplementary_data?.related_ids?.order_id ||
        resource.id;

      if (eventType === "PAYMENT.CAPTURE.COMPLETED" && !resource.supplementary_data) {
        // resource.id es el capture id; intentamos via reference_id en purchase_units si está
      }

      const { data: order } = await supabase
        .from("payments")
        .select("*")
        .eq("mp_preference_id", paypalOrderId)
        .maybeSingle();

      if (!order) {
        console.warn("PayPal order no encontrada:", paypalOrderId);
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      if (order.status === "approved") {
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
        await supabase.rpc("add_credits_system", {
          _user_id: order.user_id,
          _amount: order.credits,
          _reason: `PayPal webhook ${paypalOrderId} (${order.credits} créditos)`,
        });
        await supabase.from("payments").update({
          status: "approved",
          mp_payment_id: String(resource.id ?? paypalOrderId),
          mp_response: event,
          approved_at: new Date().toISOString(),
        }).eq("id", order.id);

        const { data: prof } = await supabase.from("profiles").select("email,display_name").eq("id", order.user_id).maybeSingle();
        const label = prof?.display_name || prof?.email || order.user_id;
        await notifyWhatsApp(`✅ *Venta PayPal aprobada*\nUsuario: ${label}\nMonto: $${order.amount_usd} USD\nCréditos: ${order.credits}`);
      }
    }

    // ===== Suscripción =====
    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
      const subId = resource.id;
      const { data: row } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("mp_preapproval_id", subId)
        .maybeSingle();
      if (row) {
        await supabase.from("subscriptions").update({
          status: "active",
          mp_response: event,
        }).eq("id", row.id);
        const { data: prof } = await supabase.from("profiles").select("email,display_name").eq("id", row.user_id).maybeSingle();
        const label = prof?.display_name || prof?.email || row.user_id;
        await notifyWhatsApp(`🎉 *Suscripción PayPal activa*\nUsuario: ${label}\nPlan: $${row.amount_usd} USD/mes\nSub: ${subId}`);
      }
    }

    if (eventType === "PAYMENT.SALE.COMPLETED" || eventType === "BILLING.SUBSCRIPTION.PAYMENT.COMPLETED") {
      // Pago recurrente: resource.billing_agreement_id contiene el subscription id
      const subId = resource.billing_agreement_id || resource.id;
      const captureId = resource.id;
      const { data: row } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("mp_preapproval_id", subId)
        .maybeSingle();
      if (row) {
        if (row.last_credited_capture_id === String(captureId)) {
          return new Response("ok", { status: 200, headers: corsHeaders });
        }
        await supabase.rpc("add_credits_system", {
          _user_id: row.user_id,
          _amount: row.monthly_credits,
          _reason: `Suscripción PayPal ${subId} - capture ${captureId}`,
        });
        await supabase.from("subscriptions").update({
          last_credited_capture_id: String(captureId),
          status: "active",
        }).eq("id", row.id);
        const { data: prof } = await supabase.from("profiles").select("email,display_name").eq("id", row.user_id).maybeSingle();
        const label = prof?.display_name || prof?.email || row.user_id;
        await notifyWhatsApp(`🔁 *Cobro PayPal*\nUsuario: ${label}\nMonto: $${row.amount_uyu} USD\nCréditos: ${row.monthly_credits}`);
      }
    }

    if (eventType === "BILLING.SUBSCRIPTION.CANCELLED" || eventType === "BILLING.SUBSCRIPTION.SUSPENDED" || eventType === "BILLING.SUBSCRIPTION.EXPIRED") {
      const subId = resource.id;
      await supabase.from("subscriptions")
        .update({ status: "cancelled", mp_response: event })
        .eq("mp_preapproval_id", subId);
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("paypal-webhook error:", e);
    return new Response("error", { status: 200, headers: corsHeaders });
  }
});