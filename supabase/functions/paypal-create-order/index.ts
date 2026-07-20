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

    const { package_id, custom_amount_usd, cmid } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let amountUsd = 0;
    let credits = 0;
    let pkgId: string | null = null;
    let title = "";

    if (custom_amount_usd !== undefined && custom_amount_usd !== null) {
      const { data: minSet } = await supabase.from("app_settings").select("value").eq("key", "paypal_min_usd").maybeSingle();
      const { data: ratioSet } = await supabase.from("app_settings").select("value").eq("key", "paypal_usd_per_credit").maybeSingle();
      const minUsd = Number(minSet?.value ?? 2);
      const usdPerCredit = Number(ratioSet?.value ?? 0.05);
      const amt = Number(custom_amount_usd);
      if (!Number.isFinite(amt) || amt < minUsd) {
        return json({ error: `Mínimo $${minUsd} USD` }, 400);
      }
      amountUsd = Math.round(amt * 100) / 100;
      credits = Math.floor(amountUsd / usdPerCredit);
      title = "Recarga personalizada";
    } else {
      if (!package_id) return json({ error: "Falta package_id o custom_amount_usd" }, 400);
      const { data: pkg } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("id", package_id)
        .eq("active", true)
        .maybeSingle();
      if (!pkg) return json({ error: "Paquete no disponible" }, 404);
      let usd = pkg.price_usd != null ? Number(pkg.price_usd) : null;
      if (usd == null) {
        // fallback derivado: UYU/40 redondeado a centavos
        usd = Math.round((Number(pkg.price_uyu) / 40) * 100) / 100;
      }
      amountUsd = usd;
      credits = pkg.credits;
      pkgId = pkg.id;
      title = pkg.name;
    }

    const { data: order, error: insErr } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        package_id: pkgId,
        amount_uyu: amountUsd,
        credits,
        status: "pending",
        mp_response: { provider: "paypal", currency: "USD" },
      })
      .select()
      .single();
    if (insErr) throw new Error(`DB: ${insErr.message}`);

    const token = await getPaypalAccessToken();
    const ppRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(cmid ? { "PayPal-Client-Metadata-Id": String(cmid) } : {}),
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: order.id,
          description: `${credits} créditos - ${title}`.slice(0, 127),
          amount: { currency_code: "USD", value: amountUsd.toFixed(2) },
        }],
      }),
    });
    const ppData = await ppRes.json();
    if (!ppRes.ok) {
      console.error("PayPal create order error:", ppData);
      await supabase.from("payments").update({ status: "rejected", mp_response: ppData }).eq("id", order.id);
      return json({ error: ppData.message || "PayPal error", details: ppData }, 500);
    }

    await supabase.from("payments")
      .update({
        mp_preference_id: ppData.id,
        mp_response: { provider: "paypal", currency: "USD", order: ppData },
      })
      .eq("id", order.id);

    return json({ id: ppData.id, internal_id: order.id });
  } catch (e) {
    console.error("paypal-create-order error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});