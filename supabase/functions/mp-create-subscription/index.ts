import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PREAPPROVAL_PLAN_ID = "19cf7b307f8741a6b5ff8933619d6277";
const MONTHLY_CREDITS = 500;
const AMOUNT_UYU = 900;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");

    const authHeader = req.headers.get("Authorization") || "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "No autenticado" }, 401);
    const user = userData.user;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Si ya tiene una suscripción authorized, devolver init_point existente o error
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["authorized", "pending"])
      .maybeSingle();

    if (existing && existing.status === "authorized") {
      return jsonResponse({ error: "Ya tenés una suscripción activa", subscription: existing }, 409);
    }

    // Crear preapproval en MP como pago pendiente.
    // Las suscripciones con plan asociado exigen card_token_id + status authorized,
    // así que usamos modalidad sin plan para obtener un init_point de checkout.
    const origin = req.headers.get("origin") || (typeof body.return_origin === "string" ? body.return_origin : "") || "https://kling-ui-manager.lovable.app";
    const backUrl = `${origin.replace(/\/$/, "")}/payment/success?subscription=1`;
    const mpBody = {
      reason: `${MONTHLY_CREDITS} créditos mensuales KNJ PRO`,
      payer_email: user.email,
      external_reference: user.id,
      back_url: backUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: AMOUNT_UYU,
        currency_id: "UYU",
      },
    };
    console.log("mp-create-subscription request:", JSON.stringify(mpBody));
    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
    });

    const mpData = await mpRes.json();
    console.log("mp-create-subscription response status:", mpRes.status, "body:", JSON.stringify(mpData));
    if (!mpRes.ok) {
      console.error("MP preapproval error:", mpData);
      const detail = mpData.message
        || (Array.isArray(mpData.cause) && mpData.cause[0]?.description)
        || JSON.stringify(mpData);
      return jsonResponse({ error: `Mercado Pago: ${detail}`, mp: mpData }, 400);
    }

    const initPoint = mpData.init_point || mpData.sandbox_init_point;

    // Upsert sub en pending
    if (existing) {
      await supabase
        .from("subscriptions")
        .update({
          mp_preapproval_id: mpData.id,
          status: "pending",
          init_point: initPoint,
          mp_response: mpData,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: user.id,
        mp_preapproval_id: mpData.id,
        preapproval_plan_id: PREAPPROVAL_PLAN_ID,
        status: "pending",
        monthly_credits: MONTHLY_CREDITS,
        amount_uyu: AMOUNT_UYU,
        init_point: initPoint,
        mp_response: mpData,
      });
    }

    return jsonResponse({
      preapproval_id: mpData.id,
      init_point: initPoint,
    });
  } catch (e) {
    console.error("mp-create-subscription error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});
