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
    const { data: roleRow } = await userClient.from("user_roles").select("role").eq("user_id", ud.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "list") {
      const { data: affs } = await svc.from("affiliates").select("*").order("created_at", { ascending: false });
      const ids = (affs || []).map(a => a.user_id);
      const { data: profiles } = ids.length
        ? await svc.from("profiles").select("id,email,display_name").in("id", ids)
        : { data: [] as any[] };
      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      return json({ affiliates: (affs || []).map(a => ({ ...a, profile: map.get(a.user_id) || null })) });
    }

    if (action === "stats") {
      const [{ count: total }, { count: approved }, { count: blocked }, { data: comms }, { data: payouts }] = await Promise.all([
        svc.from("affiliates").select("id", { count: "exact", head: true }),
        svc.from("affiliates").select("id", { count: "exact", head: true }).eq("status", "approved"),
        svc.from("affiliates").select("id", { count: "exact", head: true }).eq("status", "blocked"),
        svc.from("affiliate_commissions").select("commission_uyu,status"),
        svc.from("affiliate_payouts").select("amount_uyu,status"),
      ]);
      const totalCom = (comms || []).reduce((a: number, c: any) => a + Number(c.commission_uyu), 0);
      const pendingCom = (comms || []).filter((c: any) => c.status === "pending").reduce((a: number, c: any) => a + Number(c.commission_uyu), 0);
      const paidPay = (payouts || []).filter((p: any) => p.status === "paid").reduce((a: number, p: any) => a + Number(p.amount_uyu), 0);
      return json({ total_affiliates: total || 0, approved: approved || 0, blocked: blocked || 0, total_commissions: totalCom, pending_commissions: pendingCom, paid_payouts: paidPay });
    }

    if (action === "set_status") {
      const updates: any = { status: body.status };
      if (body.status === "approved") updates.approved_at = new Date().toISOString();
      await svc.from("affiliates").update(updates).eq("id", body.affiliate_id);
      return json({ ok: true });
    }

    if (action === "set_tier") {
      await svc.from("affiliates").update({ tier: body.tier }).eq("id", body.affiliate_id);
      return json({ ok: true });
    }

    if (action === "update_rates") {
      await svc.from("app_settings").update({ value: body.rates, updated_at: new Date().toISOString() }).eq("key", "affiliate_rates");
      return json({ ok: true });
    }

    if (action === "list_payouts") {
      const { data } = await svc
        .from("affiliate_payouts")
        .select("*, affiliates(code,user_id)")
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ payouts: data || [] });
    }

    if (action === "approve_payout") {
      await svc.from("affiliate_payouts").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", body.payout_id);
      return json({ ok: true });
    }

    if (action === "mark_paid") {
      const { error } = await svc.rpc("admin_mark_payout_paid", { _payout_id: body.payout_id, _external_ref: body.external_ref || null, _notes: body.notes || null });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "approve_pending_commissions") {
      const { data, error } = await svc.rpc("approve_pending_commissions");
      if (error) return json({ error: error.message }, 400);
      return json({ count: data });
    }

    if (action === "list_commissions") {
      const { data } = await svc.from("affiliate_commissions").select("*, affiliates(code,user_id)").order("created_at", { ascending: false }).limit(500);
      return json({ commissions: data || [] });
    }

    if (action === "export_csv") {
      const { data } = await svc.from("affiliate_commissions").select("*").order("created_at", { ascending: false });
      const headers = ["id","affiliate_id","referred_user_id","plan","gross_amount_uyu","rate","commission_uyu","status","created_at"];
      const rows = (data || []).map((c: any) => headers.map(h => JSON.stringify(c[h] ?? "")).join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      return new Response(csv, { headers: { ...cors, "Content-Type": "text/csv" } });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("affiliate-admin", e);
    return json({ error: String(e) }, 500);
  }
});
