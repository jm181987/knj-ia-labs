import { supabase } from "@/integrations/supabase/client";

interface AIResponse {
  code: number;
  message?: string;
  data?: Record<string, unknown>;
}

async function call(body: Record<string, unknown>): Promise<AIResponse> {
  const { data, error } = await supabase.functions.invoke("gemini-direct", { body });
  if (error) throw error;
  return data as AIResponse;
}

export async function generateImageAI(params: {
  prompt: string;
  model?: string;
  image_count?: number;
  aspect_ratio?: string;
}) {
  return call({ action: "generate-image", ...params });
}

export async function improvePrompt(prompt: string, type: "image" | "video" = "image") {
  const res = await call({ action: "improve-prompt", prompt, type });
  return (res.data as { prompt?: string })?.prompt || prompt;
}

export async function describeImage(image_url: string) {
  const res = await call({ action: "describe-image", image_url });
  return (res.data as { prompt?: string })?.prompt || "";
}
