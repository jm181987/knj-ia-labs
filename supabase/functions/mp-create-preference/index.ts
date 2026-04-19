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

    // Auth: extraer user del JWT
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "No autenticado" }, 401);
    const user = userData.user;

    const { package_id, custom_amount, return_origin } = await req.json();

    // Service role para leer/escribir
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let itemTitle = "";
    let itemDescription = "";
    let itemId = "";
    let amountUYU = 0;
    let credits = 0;
    let pkgIdForPayment: string | null = null;

    if (custom_amount !== undefined && custom_amount !== null) {
      const amt = Number(custom_amount);
      if (!Number.isFinite(amt) || amt < 80) {
        return jsonResponse({ error: "El monto mínimo es $80 UYU" }, 400);
      }
      // Ratio fijo: 1.99 UYU por crédito (mismo que el paquete Starter)
      const ratio = 1.99;
      credits = Math.floor(amt / ratio);
      amountUYU = Math.round(amt);
      itemId = "custom";
      itemTitle = "Recarga personalizada";
      itemDescription = `${credits} créditos para KNJ Pro`;
    } else {
      if (!package_id) return jsonResponse({ error: "Falta package_id o custom_amount" }, 400);
      const { data: pkg, error: pkgErr } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("id", package_id)
        .eq("active", true)
        .maybeSingle();
      if (pkgErr || !pkg) return jsonResponse({ error: "Paquete no disponible" }, 404);
      pkgIdForPayment = pkg.id;
      amountUYU = Number(pkg.price_uyu);
      credits = pkg.credits;
      itemId = pkg.id;
      itemTitle = pkg.name;
      itemDescription = `${pkg.credits} créditos para KNJ Pro`;
    }

    // Crear fila pending
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        package_id: pkgIdForPayment,
        amount_uyu: amountUYU,
        credits,
        status: "pending",
      })
      .select()
      .single();
    if (payErr) throw new Error(`DB: ${payErr.message}`);

    const origin = return_origin || req.headers.get("origin") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Crear preferencia en Mercado Pago
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{
          id: itemId,
          title: itemTitle,
          description: itemDescription,
          quantity: 1,
          currency_id: "UYU",
          unit_price: amountUYU,
        }],
        payer: { email: user.email },
        external_reference: payment.id,
        back_urls: {
          success: `${origin}/payment/success?payment_id=${payment.id}`,
          failure: `${origin}/payment/failure?payment_id=${payment.id}`,
          pending: `${origin}/payment/pending?payment_id=${payment.id}`,
        },
        auto_return: "approved",
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
        statement_descriptor: "KNJ Pro",
        metadata: { payment_id: payment.id, user_id: user.id, credits },
      }),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP error:", mpData);
      await supabase.from("payments").update({ status: "rejected", mp_response: mpData }).eq("id", payment.id);
      throw new Error(`MP: ${mpData.message || JSON.stringify(mpData)}`);
    }

    await supabase
      .from("payments")
      .update({ mp_preference_id: mpData.id, mp_response: mpData })
      .eq("id", payment.id);

    return jsonResponse({
      payment_id: payment.id,
      preference_id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
    });
  } catch (e) {
    console.error("mp-create-preference error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
