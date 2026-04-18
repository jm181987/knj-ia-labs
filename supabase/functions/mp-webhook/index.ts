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
    } else {
      console.log("WhatsApp notificado a", NOTIFY_TO);
    }
  } catch (err) {
    console.error("notifyWhatsApp error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");

    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch { /* MP a veces manda GET-like */ }

    // MP envía: { type: "payment", data: { id: "..." } } o ?type=payment&data.id=...
    const type = body.type || url.searchParams.get("type") || body.topic || url.searchParams.get("topic");
    const mpPaymentId =
      body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");

    console.log("MP webhook:", { type, mpPaymentId, body });

    if (type !== "payment" || !mpPaymentId) {
      return new Response("ignored", { status: 200, headers: corsHeaders });
    }

    // Consultar el pago real en MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    const mpPayment = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP fetch payment failed:", mpPayment);
      return new Response("mp error", { status: 200, headers: corsHeaders });
    }

    const externalRef = mpPayment.external_reference;
    const status = mpPayment.status as string; // approved | pending | rejected | refunded | cancelled
    if (!externalRef) {
      console.warn("Sin external_reference");
      return new Response("no ref", { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .select("*")
      .eq("id", externalRef)
      .maybeSingle();

    if (payErr || !payment) {
      console.error("Payment no encontrado:", externalRef, payErr);
      return new Response("not found", { status: 200, headers: corsHeaders });
    }

    // Idempotencia: si ya está aprobado, no acreditar otra vez
    if (payment.status === "approved" && status === "approved") {
      return new Response("already approved", { status: 200, headers: corsHeaders });
    }

    // Mapear status MP -> nuestro status
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

    // Datos del usuario para la notificación
    let userLabel = payment.user_id;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("id", payment.user_id)
        .maybeSingle();
      if (profile) userLabel = profile.display_name || profile.email || payment.user_id;
    } catch (_) { /* noop */ }

    // Acreditar créditos solo si pasa de no-approved a approved
    if (newStatus === "approved" && payment.status !== "approved") {
      const { error: creditErr } = await supabase.rpc("add_credits_system", {
        _user_id: payment.user_id,
        _amount: payment.credits,
        _reason: `Pago Mercado Pago #${mpPaymentId} (${payment.credits} créditos)`,
      });
      if (creditErr) {
        console.error("Error acreditando:", creditErr);
        await supabase.from("payments").update({ status: "pending" }).eq("id", payment.id);
        return new Response("credit error", { status: 500, headers: corsHeaders });
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

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("mp-webhook error:", e);
    return new Response("error", { status: 200, headers: corsHeaders });
  }
});
