import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY")!;
const FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL")!;
const FROM_NAME = Deno.env.get("SENDGRID_FROM_NAME") || "Equipo";

type Segment =
  | "paid"
  | "pending_failed"
  | "active_subscribers"
  | "registered_no_pay"
  | "all_registered";

interface Recipient {
  user_id: string | null;
  email: string;
  name: string;
  credits: number;
}

function applyPlaceholders(text: string, r: Recipient): string {
  return text
    .replaceAll("{{name}}", r.name || "")
    .replaceAll("{{email}}", r.email || "")
    .replaceAll("{{credits}}", String(r.credits ?? 0))
    .replaceAll("{{first_name}}", (r.name || "").split(" ")[0] || "");
}

async function getRecipients(supabase: any, segment: Segment): Promise<Recipient[]> {
  // Fetch all profiles with credits
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, display_name");
  if (pErr) throw pErr;

  const ids = (profiles ?? []).map((p: any) => p.id);
  const { data: credits } = await supabase
    .from("user_credits")
    .select("user_id, balance")
    .in("user_id", ids);
  const creditMap = new Map((credits ?? []).map((c: any) => [c.user_id, c.balance]));

  // Get payment statuses per user
  const { data: payments } = await supabase
    .from("payments")
    .select("user_id, status");
  const userPayStatuses = new Map<string, Set<string>>();
  for (const p of payments ?? []) {
    if (!userPayStatuses.has(p.user_id)) userPayStatuses.set(p.user_id, new Set());
    userPayStatuses.get(p.user_id)!.add(p.status);
  }

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("user_id, status");
  const activeSubUsers = new Set(
    (subs ?? [])
      .filter((s: any) => ["authorized", "active"].includes((s.status || "").toLowerCase()))
      .map((s: any) => s.user_id)
  );

  const all: Recipient[] = (profiles ?? [])
    .filter((p: any) => p.email)
    .map((p: any) => ({
      user_id: p.id,
      email: p.email,
      name: p.display_name || p.email.split("@")[0],
      credits: Number(creditMap.get(p.id) ?? 0),
    }));

  switch (segment) {
    case "paid":
      return all.filter((r) => userPayStatuses.get(r.user_id!)?.has("approved"));
    case "pending_failed":
      return all.filter((r) => {
        const s = userPayStatuses.get(r.user_id!);
        if (!s) return false;
        return (
          (s.has("pending") || s.has("rejected") || s.has("failed")) &&
          !s.has("approved")
        );
      });
    case "active_subscribers":
      return all.filter((r) => activeSubUsers.has(r.user_id!));
    case "registered_no_pay":
      return all.filter((r) => !userPayStatuses.has(r.user_id!));
    case "all_registered":
      return all;
    default:
      return [];
  }
}

async function sendOne(to: string, name: string, subject: string, html: string) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to, name }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  const sgId = res.headers.get("x-message-id") || null;
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SendGrid ${res.status}: ${txt.slice(0, 300)}`);
  }
  return sgId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!SENDGRID_API_KEY || !FROM_EMAIL) {
      throw new Error("SendGrid no configurado (faltan secretos)");
    }

    // Verify admin
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "no user" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const action = body.action as "preview" | "send" | "test";
    const segment = body.segment as Segment;
    const subject = String(body.subject || "");
    const html = String(body.html || "");
    const templateId = body.template_id ?? null;

    if (!subject || !html) throw new Error("subject y html requeridos");

    if (action === "test") {
      const testEmail = String(body.test_email || user.email || "");
      if (!testEmail) throw new Error("test_email requerido");
      const fake: Recipient = {
        user_id: user.id,
        email: testEmail,
        name: (user.user_metadata as any)?.display_name || testEmail.split("@")[0],
        credits: 0,
      };
      const sg = await sendOne(testEmail, fake.name, applyPlaceholders(subject, fake), applyPlaceholders(html, fake));
      return new Response(JSON.stringify({ ok: true, sent: 1, sg_message_id: sg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients = await getRecipients(admin, segment);

    if (action === "preview") {
      const sample = recipients.slice(0, 5).map((r) => ({
        email: r.email,
        name: r.name,
        subject_rendered: applyPlaceholders(subject, r),
      }));
      return new Response(
        JSON.stringify({ ok: true, total: recipients.length, sample }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "send") {
      const campaignId = crypto.randomUUID();
      let sent = 0;
      let failed = 0;
      const results: any[] = [];

      for (const r of recipients) {
        const subj = applyPlaceholders(subject, r);
        const body = applyPlaceholders(html, r);
        try {
          const sg = await sendOne(r.email, r.name, subj, body);
          await admin.from("email_sends").insert({
            campaign_id: campaignId,
            template_id: templateId,
            segment,
            recipient_email: r.email,
            recipient_user_id: r.user_id,
            subject: subj,
            status: "sent",
            sg_message_id: sg,
            sent_at: new Date().toISOString(),
          });
          sent++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await admin.from("email_sends").insert({
            campaign_id: campaignId,
            template_id: templateId,
            segment,
            recipient_email: r.email,
            recipient_user_id: r.user_id,
            subject: subj,
            status: "failed",
            error_message: msg.slice(0, 500),
          });
          failed++;
          results.push({ email: r.email, error: msg });
        }
        // small delay to be nice with SG (and avoid burst rate limit)
        await new Promise((res) => setTimeout(res, 60));
      }

      return new Response(
        JSON.stringify({ ok: true, campaign_id: campaignId, total: recipients.length, sent, failed, errors: results.slice(0, 20) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error("acción inválida");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});