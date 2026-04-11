import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const KLING_BASE_URL = "https://api.klingai.com";

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateJWT(): Promise<string> {
  const accessKey = Deno.env.get("KLING_ACCESS_KEY");
  const secretKey = Deno.env.get("KLING_SECRET_KEY");
  if (!accessKey || !secretKey) throw new Error("Kling API keys not configured");

  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 1800,
    nbf: now - 5,
    iat: now,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  const sigB64 = base64UrlEncode(new Uint8Array(sig));

  return `${signingInput}.${sigB64}`;
}

async function klingRequest(path: string, method: string, body?: unknown) {
  const token = await generateJWT();
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${KLING_BASE_URL}${path}`, opts);
  return res.json();
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const supabase = getSupabase();

    if (action === "generate-video") {
      const body: Record<string, unknown> = {
        model_name: params.model || "kling-v1",
        prompt: params.prompt,
        cfg_scale: params.cfg_scale || 0.5,
        mode: params.mode || "std",
        aspect_ratio: params.aspect_ratio || "16:9",
        duration: params.duration || "5",
      };
      if (params.negative_prompt) body.negative_prompt = params.negative_prompt;
      if (params.reference_image_url) {
        body.image = params.reference_image_url;
      }

      const endpoint = params.reference_image_url
        ? "/v1/videos/image2video"
        : "/v1/videos/text2video";

      const result = await klingRequest(endpoint, "POST", body);

      if (result.code === 0 && result.data?.task_id) {
        await supabase.from("generations").insert({
          type: "video",
          prompt: params.prompt,
          negative_prompt: params.negative_prompt || null,
          model: params.model || "kling-v1",
          duration: params.duration || "5",
          aspect_ratio: params.aspect_ratio || "16:9",
          mode: params.mode || "std",
          reference_image_url: params.reference_image_url || null,
          task_id: result.data.task_id,
          status: "processing",
          parameters: params,
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate-image") {
      const body: Record<string, unknown> = {
        model_name: params.model || "kling-v1",
        prompt: params.prompt,
        n: params.image_count || 1,
        aspect_ratio: params.aspect_ratio || "16:9",
      };
      if (params.negative_prompt) body.negative_prompt = params.negative_prompt;

      const result = await klingRequest("/v1/images/generations", "POST", body);

      if (result.code === 0 && result.data?.task_id) {
        await supabase.from("generations").insert({
          type: "image",
          prompt: params.prompt,
          negative_prompt: params.negative_prompt || null,
          model: params.model || "kling-v1",
          aspect_ratio: params.aspect_ratio || "16:9",
          image_count: params.image_count || 1,
          task_id: result.data.task_id,
          status: "processing",
          parameters: params,
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check-video-status") {
      const result = await klingRequest(
        `/v1/videos/text2video/${params.task_id}`,
        "GET"
      );

      if (result.code === 0 && result.data) {
        const task = result.data;
        let status: string = "processing";
        let resultUrls: string[] = [];

        if (task.task_status === "succeed") {
          status = "completed";
          resultUrls = (task.task_result?.videos || []).map(
            (v: { url: string }) => v.url
          );
        } else if (task.task_status === "failed") {
          status = "failed";
        }

        await supabase
          .from("generations")
          .update({
            status,
            result_urls: resultUrls,
            error_message: task.task_status_msg || null,
            updated_at: new Date().toISOString(),
          })
          .eq("task_id", params.task_id);
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check-image-status") {
      const result = await klingRequest(
        `/v1/images/generations/${params.task_id}`,
        "GET"
      );

      if (result.code === 0 && result.data) {
        const task = result.data;
        let status: string = "processing";
        let resultUrls: string[] = [];

        if (task.task_status === "succeed") {
          status = "completed";
          resultUrls = (task.task_result?.images || []).map(
            (img: { url: string }) => img.url
          );
        } else if (task.task_status === "failed") {
          status = "failed";
        }

        await supabase
          .from("generations")
          .update({
            status,
            result_urls: resultUrls,
            error_message: task.task_status_msg || null,
            updated_at: new Date().toISOString(),
          })
          .eq("task_id", params.task_id);
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-balance") {
      const result = await klingRequest("/v1/account/balance", "GET");
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-generations") {
      const query = supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false });

      if (params.type) query.eq("type", params.type);
      if (params.status) query.eq("status", params.status);
      if (params.limit) query.limit(params.limit);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ code: 0, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ code: -1, message: "Unknown action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        code: -1,
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
