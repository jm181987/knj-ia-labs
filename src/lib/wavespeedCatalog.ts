import { supabase } from "@/integrations/supabase/client";

export type WSSchemaProp = {
  type?: "string" | "integer" | "number" | "boolean" | "array" | "object";
  description?: string;
  default?: unknown;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: WSSchemaProp & { properties?: Record<string, WSSchemaProp>; required?: string[]; "x-order-properties"?: string[] };
  properties?: Record<string, WSSchemaProp>;
  required?: string[];
  "x-ui-component"?: "slider" | "uploader" | "command" | "array" | string;
  "x-hidden"?: boolean;
  "x-order-properties"?: string[];
};

export type WSRequestSchema = {
  type?: string;
  properties?: Record<string, WSSchemaProp>;
  required?: string[];
  "x-order-properties"?: string[];
};

export type WSCatalogModel = {
  model_id: string;
  name: string;
  type: string;
  description?: string;
  base_price?: number;
  sort_order?: number;
  request_schema: WSRequestSchema;
  api_path: string; // ej: /api/v3/google/veo3.1/text-to-video
};

let catalogCache: { at: number; data: WSCatalogModel[] } | null = null;
const CLIENT_TTL_MS = 10 * 60 * 1000;

export async function fetchCatalog(force = false): Promise<WSCatalogModel[]> {
  if (!force && catalogCache && Date.now() - catalogCache.at < CLIENT_TTL_MS) {
    return catalogCache.data;
  }
  const { data, error } = await supabase.functions.invoke("wavespeed-models", { body: {} });
  if (error) throw error;
  if (!data || data.code !== 0) throw new Error(data?.message || "Error cargando catálogo");
  const list = (data.data || []) as WSCatalogModel[];
  catalogCache = { at: Date.now(), data: list };
  return list;
}

// Mapeo de tipos Wavespeed → enum DB (solo "video" | "image")
export function mapDbType(wsType: string): "video" | "image" {
  if (
    wsType.includes("video") ||
    wsType === "digital-human" ||
    wsType === "portrait-transfer" ||
    wsType === "motion-control" ||
    wsType === "video-effects"
  ) {
    return "video";
  }
  return "image"; // default; cubre image-to-image, text-to-image, audio, 3d, llm, upscaler, etc.
}

// Categorías visibles agrupadas
export type CatalogCategory = {
  id: string;
  label: string;
  emoji: string;
  match: (t: string) => boolean;
};

export const CATEGORIES: CatalogCategory[] = [
  { id: "all", label: "Todos", emoji: "✨", match: () => true },
  { id: "video", label: "Video", emoji: "🎬", match: (t) => t === "text-to-video" || t === "image-to-video" || t === "video-extend" || t === "video-effects" || t === "motion-control" },
  { id: "image", label: "Imagen", emoji: "🖼️", match: (t) => t === "text-to-image" || t === "image-to-image" || t === "image-effects" },
  { id: "avatars", label: "Avatares", emoji: "👤", match: (t) => t === "digital-human" || t === "portrait-transfer" },
  { id: "upscale", label: "Upscale", emoji: "🔍", match: (t) => t === "upscaler" || t === "ai-remover" },
  { id: "audio", label: "Audio", emoji: "🎵", match: (t) => t === "text-to-audio" || t === "audio-to-audio" || t === "video-to-audio" || t === "video-dubbing" },
  { id: "3d", label: "3D", emoji: "🧊", match: (t) => t === "image-to-3d" || t === "text-to-3d" },
  { id: "video-edit", label: "Editar video", emoji: "✂️", match: (t) => t === "video-to-video" },
  { id: "transcribe", label: "Transcribir", emoji: "📝", match: (t) => t === "speech-to-text" || t === "video-to-text" || t === "image-to-text" },
];

export function getBrand(model_id: string): string {
  const slug = model_id.split("/")[0] || "";
  const map: Record<string, string> = {
    google: "Google",
    openai: "OpenAI",
    bytedance: "ByteDance",
    kwaivgi: "Kling",
    minimax: "MiniMax",
    "wavespeed-ai": "WaveSpeed",
    "black-forest-labs": "Black Forest",
    lightricks: "Lightricks",
    higgsfield: "Higgsfield",
    pixverse: "PixVerse",
    tencent: "Tencent",
    luma: "Luma",
    runway: "Runway",
    "stability-ai": "Stability AI",
    alibaba: "Alibaba",
  };
  return map[slug] || slug.split("-").map((s) => s[0]?.toUpperCase() + s.slice(1)).join(" ");
}

export function prettyName(model_id: string): string {
  const parts = model_id.split("/");
  const last = parts[parts.length - 1] || model_id;
  const mid = parts[1] || "";
  const base = mid || last;
  return base
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type SubmitDynamicArgs = {
  model: WSCatalogModel;
  values: Record<string, unknown>;
  userId?: string;
};

export async function submitDynamic(args: SubmitDynamicArgs) {
  const modelPath = args.model.api_path.replace(/^\/api\/v3\//, "");
  const dbType = mapDbType(args.model.type);
  const prompt = (args.values.prompt as string) || `${prettyName(args.model.model_id)} generation`;

  const { data, error } = await supabase.functions.invoke("wavespeed-generate", {
    body: {
      action: "submit",
      type: dbType,
      modelPath,
      modelLabel: prettyName(args.model.model_id),
      prompt,
      payload: args.values,
      userId: args.userId,
      basePrice: args.model.base_price ?? 0,
    },
  });
  if (error) return { code: 1, message: error.message };
  return data;
}

// ============ Pricing helpers (cliente) ============
let pricingSettingsCache: { at: number; markup: number; creditsPerUsd: number } | null = null;
const SETTINGS_TTL_MS = 5 * 60 * 1000;

export async function getPricingSettings(): Promise<{ markup: number; creditsPerUsd: number }> {
  if (pricingSettingsCache && Date.now() - pricingSettingsCache.at < SETTINGS_TTL_MS) {
    return { markup: pricingSettingsCache.markup, creditsPerUsd: pricingSettingsCache.creditsPerUsd };
  }
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["pricing_markup", "pricing_credits_per_usd"]);
  const map: Record<string, number> = {};
  for (const r of data || []) {
    const raw = (r as { value: unknown }).value;
    const v = typeof raw === "string" ? Number(raw) : Number(raw);
    if (!isNaN(v)) map[(r as { key: string }).key] = v;
  }
  const result = {
    markup: map.pricing_markup || 3,
    creditsPerUsd: map.pricing_credits_per_usd || 37,
  };
  pricingSettingsCache = { at: Date.now(), ...result };
  return result;
}

export function invalidatePricingCache() {
  pricingSettingsCache = null;
}

export function computeModelCost(basePrice: number | undefined, markup: number, creditsPerUsd: number): number {
  if (!basePrice || basePrice <= 0) return 1;
  return Math.max(1, Math.ceil(basePrice * markup * creditsPerUsd));
}

