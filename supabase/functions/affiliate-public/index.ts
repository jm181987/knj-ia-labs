import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function sha(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (req.method === "POST" ? (await req.clone().json().catch(() => ({}))).action : null);

    if (action === "track") {
      const body = await req.json().catch(() => ({}));
      const code = String(body.code || "").toLowerCase();
      if (!code) return json({ ok: false }, 200);
      const { data: aff } = await supabase.from("affiliates").select("id,status").eq("code", code).maybeSingle();
      if (!aff || aff.status === "blocked" || aff.status === "rejected") return json({ ok: false });
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
      const ua = req.headers.get("user-agent") || "";
      await supabase.from("affiliate_clicks").insert({
        affiliate_id: aff.id,
        ip_hash: ip ? await sha(ip) : null,
        ua_hash: ua ? await sha(ua) : null,
        landing_path: body.path || null,
        referrer: body.referrer || null,
      });
      return json({ ok: true });
    }

    if (action === "lookup") {
      const code = String(url.searchParams.get("code") || "").toLowerCase();
      const { data } = await supabase.from("affiliates").select("code,status").eq("code", code).maybeSingle();
      return json({ valid: !!data && data.status !== "blocked" && data.status !== "rejected" });
    }

    if (action === "leaderboard") {
      const { data } = await supabase
        .from("affiliates")
        .select("code,tier,total_earned,public_profile")
        .eq("public_profile", true)
        .eq("status", "approved")
        .order("total_earned", { ascending: false })
        .limit(10);
      return json({ leaderboard: data || [] });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("affiliate-public", e);
    return json({ error: String(e) }, 500);
  }
});
