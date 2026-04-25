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

async function mpSearchByExternalReference(token: string, externalRef: string) {
  const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalRef)}&sort=date_created&criteria=desc`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`MP search failed: ${data?.message || JSON.stringify(data)}`);
  }
  return (data?.results || []) as any[];
}

function mapStatus(s: string): "approved" | "rejected" | "refunded" | "pending" {
  if (s === "approved") return "approved";
  if (s === "rejected" || s === "cancelled") return "rejected";
  if (s === "refunded") return "refunded";
  return "pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");

    // Auth: solo admins
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "No autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return jsonResponse({ error: "No autorizado" }, 403);

    // Body opcional: { payment_id?: string, hours?: number }
    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    const targetPaymentId: string | undefined = body?.payment_id;
    const hoursBack: number = Math.min(Math.max(Number(body?.hours) || 72, 1), 720);

    // Seleccionar pagos pending a reconciliar
    let query = supabase
      .from("payments")
      .select("id, user_id, credits, amount_uyu, status, mp_preference_id, mp_payment_id, created_at")
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - hoursBack * 3600 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (targetPaymentId) {
      query = supabase
        .from("payments")
        .select("id, user_id, credits, amount_uyu, status, mp_preference_id, mp_payment_id, created_at")
        .eq("id", targetPaymentId)
        .limit(1);
    }

    const { data: payments, error: payErr } = await query;
    if (payErr) throw payErr;

    const results: any[] = [];

    for (const p of payments || []) {
      try {
        const mpPayments = await mpSearchByExternalReference(MP_TOKEN, p.id);

        if (!mpPayments.length) {
          results.push({ payment_id: p.id, action: "no_mp_payment_found" });
          continue;
        }

        // Preferir el más reciente approved; si no, el más reciente
        const approved = mpPayments.find((x) => x.status === "approved");
        const chosen = approved || mpPayments[0];
        const newStatus = mapStatus(chosen.status);
        const mpPaymentId = String(chosen.id);

        // Si ya estaba con ese mp_payment_id, skip
        if (p.mp_payment_id === mpPaymentId && p.status === newStatus) {
          results.push({ payment_id: p.id, action: "already_synced", status: newStatus });
          continue;
        }

        // Update payment row
        const { error: updErr } = await supabase
          .from("payments")
          .update({
            status: newStatus,
            mp_payment_id: mpPaymentId,
            mp_response: chosen,
            approved_at: newStatus === "approved" ? (chosen.date_approved || new Date().toISOString()) : null,
          })
          .eq("id", p.id);
        if (updErr) throw updErr;

        // Si pasó a approved y antes no estaba acreditado, acreditar créditos
        let credited = false;
        if (newStatus === "approved" && p.status !== "approved") {
          const { error: creditErr } = await supabase.rpc("add_credits_system", {
            _user_id: p.user_id,
            _amount: p.credits,
            _reason: `Reconciliación MP #${mpPaymentId} (${p.credits} créditos)`,
          });
          if (creditErr) {
            // revertir status para que se reintente
            await supabase.from("payments").update({ status: "pending" }).eq("id", p.id);
            throw creditErr;
          }
          credited = true;
        }

        results.push({
          payment_id: p.id,
          action: "updated",
          new_status: newStatus,
          mp_payment_id: mpPaymentId,
          credited,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("Reconcile error for", p.id, msg);
        results.push({ payment_id: p.id, action: "error", error: msg });
      }
    }

    return jsonResponse({
      checked: payments?.length || 0,
      results,
    });
  } catch (e) {
    console.error("mp-reconcile-payments error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
  }
});