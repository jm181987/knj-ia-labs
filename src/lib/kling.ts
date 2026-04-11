import { supabase } from "@/integrations/supabase/client";

interface KlingResponse {
  code: number;
  message?: string;
  data?: Record<string, unknown>;
}

async function callKling(body: Record<string, unknown>): Promise<KlingResponse> {
  const { data, error } = await supabase.functions.invoke("kling-generate", {
    body,
  });
  if (error) throw error;
  return data as KlingResponse;
}

export async function generateVideo(params: {
  prompt: string;
  model?: string;
  duration?: string;
  aspect_ratio?: string;
  mode?: string;
  negative_prompt?: string;
  reference_image_url?: string;
}) {
  return callKling({ action: "generate-video", ...params });
}

export async function generateImage(params: {
  prompt: string;
  model?: string;
  aspect_ratio?: string;
  image_count?: number;
  negative_prompt?: string;
}) {
  return callKling({ action: "generate-image", ...params });
}

export async function checkVideoStatus(taskId: string) {
  return callKling({ action: "check-video-status", task_id: taskId });
}

export async function checkImageStatus(taskId: string) {
  return callKling({ action: "check-image-status", task_id: taskId });
}

export interface Generation {
  id: string;
  type: "video" | "image";
  prompt: string;
  negative_prompt: string | null;
  model: string | null;
  duration: string | null;
  aspect_ratio: string | null;
  mode: string | null;
  image_count: number | null;
  reference_image_url: string | null;
  task_id: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  result_urls: string[];
  error_message: string | null;
  parameters: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function listGenerations(params?: {
  type?: string;
  status?: string;
  limit?: number;
}): Promise<Generation[]> {
  const res = await callKling({
    action: "list-generations",
    ...(params || {}),
  });
  return (res.data as unknown as Generation[]) || [];
}
