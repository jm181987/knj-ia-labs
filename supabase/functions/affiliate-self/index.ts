import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ud } = await userClient.auth.getUser();
    if (!ud?.user) return json({ error: "unauth" }, 401);
    const user = ud.user;
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "me") {
      const { data: aff } = await svc.from("affiliates").select("*").eq("user_id", user.id).maybeSingle();
      if (!aff) return json({ affiliate: null });
      const [{ data: clicks }, { data: refs }, { data: comms }, { data: payouts }] = await Promise.all([
        svc.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("affiliate_id", aff.id),
        svc.from("affiliate_referrals").select("*").eq("affiliate_id", aff.id),
        svc.from("affiliate_commissions").select("*").eq("affiliate_id", aff.id).order("created_at", { ascending: false }).limit(50),
        svc.from("affiliate_payouts").select("*").eq("affiliate_id", aff.id).order("created_at", { ascending: false }),
      ]);
      const clicksCount = (clicks as any)?.length ?? null;
      // count via head:true returns count via headers but supabase-js exposes it differently; use separate count call
      const { count: clickCount } = await svc.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("affiliate_id", aff.id);
      const conv = (refs || []).length;
      const sales = (comms || []).filter((c: any) => c.status !== "rejected" && c.status !== "reversed");
      const pendingApproved = (comms || []).filter((c: any) => c.status === "approved").reduce((a: number, c: any) => a + Number(c.commission_uyu), 0);
      const grossSales = sales.reduce((a: number, c: any) => a + Number(c.gross_amount_uyu), 0);
      return json({
        affiliate: aff,
        stats: {
          clicks: clickCount || 0,
          referrals: conv,
          conversions: sales.length,
          gross_sales_uyu: grossSales,
          pending_balance: Number(aff.pending_balance),
          approved_balance: pendingApproved,
          total_paid: Number(aff.total_paid),
          total_earned: Number(aff.total_earned),
        },
        commissions: comms || [],
        payouts: payouts || [],
      });
    }

    if (action === "register") {
      const { data, error } = await userClient.rpc("register_affiliate", { _code: String(body.code || "") });
      if (error) return json({ error: error.message }, 400);
      return json({ affiliate: data });
    }

    if (action === "update_payout") {
      const { data: aff } = await svc.from("affiliates").select("id").eq("user_id", user.id).maybeSingle();
      if (!aff) return json({ error: "no_affiliate" }, 404);
      await svc.from("affiliates").update({
        payout_method: body.method || null,
        payout_details: body.details || {},
        public_profile: !!body.public_profile,
      }).eq("id", aff.id);
      return json({ ok: true });
    }

    if (action === "request_payout") {
      const { data, error } = await userClient.rpc("request_affiliate_payout");
      if (error) {
        const message = error.message || "request_failed";
        const isExpectedRule = /below_minimum|not_approved|not authenticated/i.test(message);
        return json({ error: message }, isExpectedRule ? 200 : 400);
      }
      return json({ payout: data });
    }

    if (action === "attribute") {
      // Called right after signup with ref code
      const code = String(body.code || "").toLowerCase();
      if (!code) return json({ ok: false });
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
      const ipHash = ip ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)))).map(b=>b.toString(16).padStart(2,"0")).join("") : null;
      const { data, error } = await svc.rpc("attribute_referral", { _referred_user_id: user.id, _ref_code: code, _ip_hash: ipHash });
      if (error) return json({ ok: false, error: error.message });
      return json({ ok: !!data });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("affiliate-self", e);
    return json({ error: String(e) }, 500);
  }
});
