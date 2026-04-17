import { supabase } from "@/integrations/supabase/client";

export type WSModel = {
  id: string;              // identificador interno único
  label: string;           // nombre visible
  brand: string;           // marca / empresa
  type: "video" | "image";
  modelPath: string;       // ruta de WaveSpeed (ej: "bytedance/seedance-v1-pro-t2v-480p")
  supportsImage?: boolean; // image-to-video / image-to-image
  durations?: number[];    // segundos disponibles (video)
  aspects?: string[];      // aspect ratios soportados
};

// Catálogo curado (subset popular de los 700+). Fácilmente ampliable.
export const MODELS: WSModel[] = [
  // ===== VIDEO =====
  { id: "sora-2", label: "Sora 2", brand: "OpenAI", type: "video",
    modelPath: "openai/sora-2/text-to-video", durations: [4, 8, 12], aspects: ["16:9","9:16","1:1"] },
  { id: "veo-3.1", label: "Veo 3.1", brand: "Google", type: "video",
    modelPath: "google/veo3.1/text-to-video", durations: [4, 8], aspects: ["16:9","9:16"] },
  { id: "veo-3.1-i2v", label: "Veo 3.1 (Image)", brand: "Google", type: "video",
    modelPath: "google/veo3.1/image-to-video", supportsImage: true, durations: [4, 8], aspects: ["16:9","9:16"] },
  { id: "kling-2.5", label: "Kling 2.5 Pro", brand: "Kling", type: "video",
    modelPath: "kwaivgi/kling-v2.5-turbo-pro/text-to-video", durations: [5, 10], aspects: ["16:9","9:16","1:1"] },
  { id: "kling-2.5-i2v", label: "Kling 2.5 (Image)", brand: "Kling", type: "video",
    modelPath: "kwaivgi/kling-v2.5-turbo-pro/image-to-video", supportsImage: true, durations: [5, 10], aspects: ["16:9","9:16","1:1"] },
  { id: "seedance-v2", label: "Seedance 2.0", brand: "ByteDance", type: "video",
    modelPath: "bytedance/seedance-v1-pro-t2v-1080p", durations: [5, 10], aspects: ["16:9","9:16","1:1"] },
  { id: "hailuo-02", label: "Hailuo 02", brand: "MiniMax", type: "video",
    modelPath: "minimax/hailuo-02/standard/text-to-video", durations: [6, 10], aspects: ["16:9","9:16","1:1"] },
  { id: "wan-2.7", label: "WAN 2.7", brand: "Alibaba", type: "video",
    modelPath: "wavespeed-ai/wan-2.7/text-to-video", durations: [5], aspects: ["16:9","9:16","1:1"] },
  { id: "ltxv", label: "LTXV", brand: "Lightricks", type: "video",
    modelPath: "lightricks/ltx-video", durations: [5], aspects: ["16:9","9:16"] },
  { id: "higgsfield", label: "Higgsfield", brand: "Higgsfield", type: "video",
    modelPath: "higgsfield/higgsfield-1", durations: [5], aspects: ["16:9","9:16"] },

  // ===== IMAGE =====
  { id: "nano-banana-2", label: "Nano Banana 2", brand: "Google", type: "image",
    modelPath: "google/nano-banana-2/text-to-image", aspects: ["1:1","16:9","9:16","3:2","2:3"] },
  { id: "seedream-4.5", label: "Seedream 4.5", brand: "ByteDance", type: "image",
    modelPath: "bytedance/seedream-v4/text-to-image", aspects: ["1:1","16:9","9:16","3:2","2:3"] },
  { id: "flux-2", label: "FLUX 2", brand: "Black Forest", type: "image",
    modelPath: "wavespeed-ai/flux-2-dev", aspects: ["1:1","16:9","9:16","3:2","2:3"] },
  { id: "flux-dev", label: "FLUX.1 Dev", brand: "Black Forest", type: "image",
    modelPath: "wavespeed-ai/flux-dev", aspects: ["1:1","16:9","9:16"] },
];

export function getModel(id: string): WSModel | undefined {
  return MODELS.find((m) => m.id === id);
}

export type SubmitArgs = {
  type: "video" | "image";
  modelId: string;
  prompt: string;
  aspect_ratio?: string;
  duration?: number;
  negative_prompt?: string;
  image_url?: string;
};

export async function submitGeneration(args: SubmitArgs): Promise<{ code: number; data?: { id: string; task_id: string }; message?: string }> {
  const m = getModel(args.modelId);
  if (!m) return { code: 1, message: "Modelo desconocido" };

  const payload: Record<string, unknown> = { prompt: args.prompt };
  if (args.aspect_ratio) payload.aspect_ratio = args.aspect_ratio;
  if (args.duration) payload.duration = args.duration;
  if (args.negative_prompt) payload.negative_prompt = args.negative_prompt;
  if (args.image_url && m.supportsImage) payload.image = args.image_url;

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.functions.invoke("wavespeed-generate", {
    body: {
      action: "submit",
      type: args.type,
      modelPath: m.modelPath,
      modelLabel: m.label,
      prompt: args.prompt,
      payload,
      userId: user?.id,
    },
  });
  if (error) return { code: 1, message: error.message };
  return data;
}

export async function pollGeneration(generation_id: string) {
  const { data, error } = await supabase.functions.invoke("wavespeed-generate", {
    body: { action: "poll", generation_id },
  });
  if (error) return { code: 1, message: error.message };
  return data as { code: number; data?: { status: string; urls?: string[]; error?: string }; message?: string };
}
