const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TrackingPayload = {
  eventName?: string;
  eventSourceUrl?: string;
  eventId?: string;
  fbp?: string;
  fbc?: string;
  email?: string;
  customData?: Record<string, unknown>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const pixelId = Deno.env.get("META_PIXEL_ID");
    const accessToken = Deno.env.get("META_PIXEL_ACCESS_TOKEN");

    if (!pixelId || !accessToken) {
      return jsonResponse({ error: "Meta Pixel no configurado" }, 500);
    }

    const payload = (await req.json().catch(() => ({}))) as TrackingPayload;
    const eventName = payload.eventName || "PageView";
    const allowedEvents = new Set([
      "PageView",
      "ViewContent",
      "Lead",
      "CompleteRegistration",
      "InitiateCheckout",
      "AddPaymentInfo",
      "Subscribe",
      "Purchase",
    ]);

    if (!allowedEvents.has(eventName)) {
      return jsonResponse({ error: "Evento no permitido" }, 400);
    }

    const userData: Record<string, string> = {};
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = req.headers.get("user-agent");
    if (ip) userData.client_ip_address = ip;
    if (userAgent) userData.client_user_agent = userAgent;
    if (payload.fbp) userData.fbp = payload.fbp;
    if (payload.fbc) userData.fbc = payload.fbc;
    if (payload.email) {
      userData.em = await sha256Hex(payload.email);
    }

    const customData = payload.customData && typeof payload.customData === "object"
      ? payload.customData
      : undefined;

    const metaPayload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: payload.eventId || crypto.randomUUID(),
          event_source_url: payload.eventSourceUrl,
          action_source: "website",
          user_data: userData,
          ...(customData ? { custom_data: customData } : {}),
        },
      ],
    };

    const response = await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metaPayload),
    });

    const result = await response.json();
    if (!response.ok) {
      return jsonResponse({ error: result?.error?.message || "Meta CAPI error" }, response.status);
    }

    return jsonResponse({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});