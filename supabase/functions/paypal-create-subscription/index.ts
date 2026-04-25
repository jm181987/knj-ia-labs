import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PAYPAL_BASE, getPaypalAccessToken } from "../_shared/paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function ensurePlan(supabase: any, token: string, priceUsd: number): Promise<string> {
  // ¿Ya hay plan guardado?
  const { data: planSet } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "paypal_subscription_plan_id")
    .maybeSingle();
  const existing = (planSet?.value || "").toString().replace(/^"|"$/g, "");
  if (existing) return existing;

  // Crear product
  const prodRes = await fetch(`${PAYPAL_BASE}/v1/catalogs/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "KNJ Pro - Suscripción mensual",
      description: "500 créditos por mes",
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });
  const prod = await prodRes.json();
  if (!prodRes.ok) throw new Error(`PayPal product error: ${JSON.stringify(prod)}`);

  // Crear plan mensual
  const planRes = await fetch(`${PAYPAL_BASE}/v1/billing/plans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: prod.id,
      name: "KNJ Pro Mensual",
      status: "ACTIVE",
      billing_cycles: [{
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: { value: priceUsd.toFixed(2), currency_code: "USD" },
        },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    }),
  });
  const plan = await planRes.json();
  if (!planRes.ok) throw new Error(`PayPal plan error: ${JSON.stringify(plan)}`);

  await supabase.from("app_settings").upsert({
    key: "paypal_subscription_plan_id",
    value: JSON.stringify(plan.id),
  });
  return plan.id as string;
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

    const { return_origin } = await req.json().catch(() => ({}));
    const origin = return_origin || req.headers.get("origin") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: priceSet } = await supabase.from("app_settings").select("value").eq("key", "paypal_subscription_price_usd").maybeSingle();
    const { data: credSet } = await supabase.from("app_settings").select("value").eq("key", "paypal_subscription_credits").maybeSingle();
    const priceUsd = Number(priceSet?.value ?? 22.5);
    const credits = Number(credSet?.value ?? 500);

    const token = await getPaypalAccessToken();
    const planId = await ensurePlan(supabase, token, priceUsd);

    // Pre-row para tracking
    const { data: row, error: insErr } = await supabase
      .from("paypal_orders")
      .insert({
        user_id: user.id,
        kind: "subscription",
        paypal_plan_id: planId,
        amount_usd: priceUsd,
        credits,
        status: "pending",
      })
      .select()
      .single();
    if (insErr) throw new Error(`DB: ${insErr.message}`);

    const subRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: row.id,
        subscriber: { email_address: user.email },
        application_context: {
          brand_name: "KNJ Pro",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${origin}/payment/success?paypal_sub=1`,
          cancel_url: `${origin}/payment/failure?paypal_sub=1`,
        },
      }),
    });
    const subData = await subRes.json();
    if (!subRes.ok) {
      console.error("PayPal subscription error:", subData);
      await supabase.from("paypal_orders").update({ status: "rejected", paypal_response: subData }).eq("id", row.id);
      return json({ error: subData.message || "PayPal error", details: subData }, 500);
    }

    await supabase.from("paypal_orders").update({
      paypal_subscription_id: subData.id,
      paypal_response: subData,
    }).eq("id", row.id);

    const approve = (subData.links || []).find((l: any) => l.rel === "approve");
    return json({
      subscription_id: subData.id,
      approve_url: approve?.href,
    });
  } catch (e) {
    console.error("paypal-create-subscription error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});