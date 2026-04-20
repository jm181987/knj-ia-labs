import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_TO = "59893867429"; // WhatsApp destino (Jorge)

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
      const body = await res.text();
      console.error("Evolution send failed", res.status, body);
    }
  } catch (err) {
    console.error("notifyWhatsApp error:", err);
  }
}

async function handlePayment(supabase: any, MP_TOKEN: string, mpPaymentId: string) {
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  const mpPayment = await mpRes.json();
  if (!mpRes.ok) {
    console.error("MP fetch payment failed:", mpPayment);
    return;
  }

  const status = mpPayment.status as string;

  // ¿Es un cobro recurrente de suscripción? (tiene preapproval_id)
  const preapprovalId = mpPayment.preapproval_id || mpPayment?.point_of_interaction?.transaction_data?.preapproval_id;

  if (preapprovalId) {
    // Pago recurrente de suscripción
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("mp_preapproval_id", preapprovalId)
      .maybeSingle();

    if (!sub) {
      console.warn("Subscription no encontrada para preapproval:", preapprovalId);
      return;
    }

    // Idempotencia: no acreditar dos veces el mismo payment
    if (sub.last_credited_payment_id === String(mpPaymentId)) {
      console.log("Pago de suscripción ya acreditado:", mpPaymentId);
      return;
    }

    if (status === "approved") {
      const { error: creditErr } = await supabase.rpc("add_credits_system", {
        _user_id: sub.user_id,
        _amount: sub.monthly_credits,
        _reason: `Suscripción mensual MP #${mpPaymentId} (${sub.monthly_credits} créditos)`,
      });
      if (creditErr) {
        console.error("Error acreditando suscripción:", creditErr);
        return;
      }
      await supabase
        .from("subscriptions")
        .update({
          last_credited_payment_id: String(mpPaymentId),
          status: "authorized",
        })
        .eq("id", sub.id);

      let userLabel = sub.user_id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("id", sub.user_id)
        .maybeSingle();
      if (profile) userLabel = profile.display_name || profile.email || sub.user_id;

      await notifyWhatsApp(
        `🔁 *Suscripción cobrada*\n` +
        `Usuario: ${userLabel}\n` +
        `Monto: $${sub.amount_uyu} UYU\n` +
        `Créditos: ${sub.monthly_credits}\n` +
        `MP ID: ${mpPaymentId}`
      );
    } else if (status === "rejected" || status === "cancelled") {
      await notifyWhatsApp(
        `⚠️ *Cobro de suscripción falló*\n` +
        `User: ${sub.user_id}\n` +
        `MP ID: ${mpPaymentId}\n` +
        `Status: ${status}`
      );
    }
    return;
  }

  // Pago único (paquete o custom)
  const externalRef = mpPayment.external_reference;
  if (!externalRef) {
    console.warn("Sin external_reference y sin preapproval_id");
    return;
  }

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("*")
    .eq("id", externalRef)
    .maybeSingle();

  if (payErr || !payment) {
    console.error("Payment no encontrado:", externalRef, payErr);
    return;
  }

  if (payment.status === "approved" && status === "approved") return;

  const newStatus =
    status === "approved" ? "approved" :
    status === "rejected" || status === "cancelled" ? "rejected" :
    status === "refunded" ? "refunded" : "pending";

  await supabase
    .from("payments")
    .update({
      status: newStatus,
      mp_payment_id: String(mpPaymentId),
      mp_response: mpPayment,
      approved_at: newStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", payment.id);

  let userLabel = payment.user_id;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", payment.user_id)
      .maybeSingle();
    if (profile) userLabel = profile.display_name || profile.email || payment.user_id;
  } catch (_) {}

  if (newStatus === "approved" && payment.status !== "approved") {
    const { error: creditErr } = await supabase.rpc("add_credits_system", {
      _user_id: payment.user_id,
      _amount: payment.credits,
      _reason: `Pago Mercado Pago #${mpPaymentId} (${payment.credits} créditos)`,
    });
    if (creditErr) {
      console.error("Error acreditando:", creditErr);
      await supabase.from("payments").update({ status: "pending" }).eq("id", payment.id);
      return;
    }
    await notifyWhatsApp(
      `✅ *Venta aprobada*\n` +
      `Usuario: ${userLabel}\n` +
      `Monto: $${payment.amount_uyu} UYU\n` +
      `Créditos: ${payment.credits}\n` +
      `MP ID: ${mpPaymentId}`
    );
  } else if (newStatus === "rejected" && payment.status !== "rejected") {
    await notifyWhatsApp(
      `❌ *Pago rechazado*\n` +
      `Usuario: ${userLabel}\n` +
      `Monto: $${payment.amount_uyu} UYU\n` +
      `Motivo: ${mpPayment.status_detail || "n/a"}\n` +
      `MP ID: ${mpPaymentId}`
    );
  }
}

async function handlePreapproval(supabase: any, MP_TOKEN: string, preapprovalId: string) {
  const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  const data = await mpRes.json();
  if (!mpRes.ok) {
    console.error("MP fetch preapproval failed:", data);
    return;
  }

  const status = data.status as string; // authorized | paused | cancelled | pending
  const externalRef = data.external_reference; // user_id

  // Buscar por preapproval_id; fallback por external_reference
  let { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("mp_preapproval_id", preapprovalId)
    .maybeSingle();

  if (!sub && externalRef) {
    const { data: byUser } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", externalRef)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sub = byUser;
    if (sub) {
      await supabase
        .from("subscriptions")
        .update({ mp_preapproval_id: preapprovalId })
        .eq("id", sub.id);
    }
  }

  if (!sub) {
    console.warn("Subscription no encontrada para preapproval:", preapprovalId);
    return;
  }

  await supabase
    .from("subscriptions")
    .update({
      status,
      next_payment_date: data.next_payment_date || null,
      mp_response: data,
    })
    .eq("id", sub.id);

  if (status === "authorized") {
    await notifyWhatsApp(
      `🎉 *Nueva suscripción activa*\n` +
      `User: ${sub.user_id}\n` +
      `Plan: ${sub.amount_uyu} UYU/mes\n` +
      `Preapproval: ${preapprovalId}`
    );
  } else if (status === "cancelled") {
    await notifyWhatsApp(
      `🚫 *Suscripción cancelada*\n` +
      `User: ${sub.user_id}\n` +
      `Preapproval: ${preapprovalId}`
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");

    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }

    const type = body.type || url.searchParams.get("type") || body.topic || url.searchParams.get("topic");
    const resourceId =
      body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");

    console.log("MP webhook:", { type, resourceId, body });

    if (!resourceId) {
      return new Response("ignored", { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (type === "payment") {
      await handlePayment(supabase, MP_TOKEN, String(resourceId));
    } else if (type === "preapproval" || type === "subscription_preapproval") {
      await handlePreapproval(supabase, MP_TOKEN, String(resourceId));
    } else if (type === "authorized_payment" || type === "subscription_authorized_payment") {
      // Pago recurrente — viene como payment_id en algunos casos, o requiere fetch al recurso
      // Intentamos como payment primero
      await handlePayment(supabase, MP_TOKEN, String(resourceId));
    } else {
      console.log("Tipo de webhook ignorado:", type);
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("mp-webhook error:", e);
    return new Response("error", { status: 200, headers: corsHeaders });
  }
});
