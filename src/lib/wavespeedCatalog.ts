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
    "wavespeed-ai": "KNJ",
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
export type PricingSettings = { markup: number; creditsPerUsd: number; mpFeePct: number };

let pricingSettingsCache: { at: number } & PricingSettings | null = null;
const SETTINGS_TTL_MS = 5 * 60 * 1000;

export async function getPricingSettings(): Promise<PricingSettings> {
  if (pricingSettingsCache && Date.now() - pricingSettingsCache.at < SETTINGS_TTL_MS) {
    const { at, ...rest } = pricingSettingsCache;
    return rest;
  }
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["pricing_markup", "pricing_credits_per_usd", "pricing_mp_fee_pct"]);
  const map: Record<string, number> = {};
  for (const r of data || []) {
    const raw = (r as { value: unknown }).value;
    const v = typeof raw === "string" ? Number(raw) : Number(raw);
    if (!isNaN(v)) map[(r as { key: string }).key] = v;
  }
  const result: PricingSettings = {
    markup: map.pricing_markup || 3,
    creditsPerUsd: map.pricing_credits_per_usd || 37,
    mpFeePct: map.pricing_mp_fee_pct ?? 7.99,
  };
  pricingSettingsCache = { at: Date.now(), ...result };
  return result;
}

export function invalidatePricingCache() {
  pricingSettingsCache = null;
}

// Compensa la comisión de Mercado Pago (mpFeePct%) inflando el markup,
// para que el margen neto coincida con el markup configurado.
export function computeModelCost(
  basePrice: number | undefined,
  markup: number,
  creditsPerUsd: number,
  mpFeePct: number = 0
): number {
  if (!basePrice || basePrice <= 0) return 1;
  const feeFactor = 1 - Math.min(Math.max(mpFeePct, 0), 99) / 100;
  const effectiveMarkup = markup / feeFactor;
  return Math.max(1, Math.ceil(basePrice * effectiveMarkup * creditsPerUsd));
}

// ============ Multiplicadores dinámicos por parámetros ============
// Estima el costo real (en USD) de una generación según los valores que
// el usuario eligió en el formulario. Aplica heurísticas comunes de
// Wavespeed: duración, cantidad de imágenes, resolución y frames.

const RESOLUTION_MULT: Record<string, number> = {
  "256p": 0.5,
  "360p": 0.7,
  "480p": 1,
  "540p": 1.2,
  "576p": 1.3,
  "720p": 1.5,
  "768p": 1.7,
  "1080p": 2.5,
  "1440p": 3.5,
  "2k": 3.5,
  "4k": 5,
  "2160p": 5,
};

function resolutionMultiplier(value: unknown): number {
  if (value == null) return 1;
  const s = String(value).toLowerCase().trim();
  if (RESOLUTION_MULT[s]) return RESOLUTION_MULT[s];
  // Soporta formatos "1280x720", "1920*1080"
  const m = s.match(/(\d{2,5})\s*[x*×]\s*(\d{2,5})/);
  if (m) {
    const w = Number(m[1]); const h = Number(m[2]);
    const px = w * h;
    // base 480p ≈ 854x480 = 410k px
    const ratio = px / 410_000;
    if (ratio <= 0) return 1;
    return Math.max(0.5, Math.min(8, ratio));
  }
  // Soporta "720", "1080", etc.
  const num = Number(s.replace(/[^\d]/g, ""));
  if (Number.isFinite(num) && num > 0) {
    const key = `${num}p`;
    if (RESOLUTION_MULT[key]) return RESOLUTION_MULT[key];
  }
  return 1;
}

function numericValue(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Devuelve el factor multiplicador total a aplicar sobre base_price
 * según los valores del formulario. Resultado típico entre 0.5x y 10x.
 */
export function computeDynamicMultiplier(
  values: Record<string, unknown> | undefined,
  schemaProps: Record<string, WSSchemaProp> | undefined,
): number {
  if (!values) return 1;
  let mult = 1;

  // Duración: keys comunes
  const durKey = ["duration", "num_seconds", "seconds", "video_length"].find((k) => k in values);
  if (durKey) {
    const d = numericValue(values[durKey]);
    const baseDur = numericValue(schemaProps?.[durKey]?.default) || 5;
    if (d && d > 0 && baseDur > 0) mult *= d / baseDur;
  }

  // Cantidad de imágenes / outputs
  const countKey = ["num_images", "image_count", "n", "num_outputs", "batch_size"].find((k) => k in values);
  if (countKey) {
    const c = numericValue(values[countKey]);
    const baseC = numericValue(schemaProps?.[countKey]?.default) || 1;
    if (c && c > 0 && baseC > 0) mult *= c / baseC;
  }

  // Resolución / size
  const resKey = ["resolution", "size", "aspect_ratio_resolution", "video_resolution"].find((k) => k in values);
  if (resKey) {
    const baseRes = schemaProps?.[resKey]?.default;
    const userMult = resolutionMultiplier(values[resKey]);
    const baseMult = resolutionMultiplier(baseRes) || 1;
    if (baseMult > 0) mult *= userMult / baseMult;
  }

  // Frames (modelos tipo wan/hunyuan: base 81 frames)
  const framesKey = ["num_frames", "frames"].find((k) => k in values);
  if (framesKey) {
    const f = numericValue(values[framesKey]);
    const baseF = numericValue(schemaProps?.[framesKey]?.default) || 81;
    if (f && f > 0 && baseF > 0) mult *= f / baseF;
  }

  // Pasos de inferencia (sólo si el usuario los sube mucho)
  const stepsKey = ["num_inference_steps", "steps"].find((k) => k in values);
  if (stepsKey) {
    const s = numericValue(values[stepsKey]);
    const baseS = numericValue(schemaProps?.[stepsKey]?.default) || 30;
    if (s && s > 0 && baseS > 0) {
      const r = s / baseS;
      // Solo penaliza si excede el default (no descuenta si baja)
      if (r > 1) mult *= r;
    }
  }

  // Clamp para evitar números absurdos
  return Math.max(0.25, Math.min(mult, 20));
}

/**
 * Multiplicador específico por modelo. Replica la lógica del backend
 * para reflejar el costo real que cobra Wavespeed en modelos que
 * escalan por duración de audio/video (ej: multitalk).
 */
export function computeModelSpecificMultiplier(
  modelPath: string,
  values: Record<string, unknown> | undefined,
): number {
  if (!values) return 1;
  const path = modelPath.toLowerCase();

  if (path.includes("multitalk")) {
    const dur = numericValue(values.duration) ?? numericValue(values.num_seconds) ?? numericValue(values.seconds);
    if (dur && dur > 0) return Math.max(1, dur / 5);
    // Sin campo de duración: la define el audio. Estimamos hasta ~20s (4x).
    return 4;
  }

  if (path.includes("veo") || path.includes("sora")) {
    const dur = numericValue(values.duration);
    if (dur && dur > 8) return dur / 8;
  }

  return 1;
}

/**
 * Versión "dinámica" del costo: aplica multiplicadores según valores.
 */
export function computeModelCostDynamic(
  basePrice: number | undefined,
  markup: number,
  creditsPerUsd: number,
  mpFeePct: number,
  values: Record<string, unknown> | undefined,
  schemaProps: Record<string, WSSchemaProp> | undefined,
  modelPath?: string,
): number {
  if (!basePrice || basePrice <= 0) return 1;
  const mult = computeDynamicMultiplier(values, schemaProps);
  const modelMult = modelPath ? computeModelSpecificMultiplier(modelPath, values) : 1;
  const effective = basePrice * mult * modelMult;
  const feeFactor = 1 - Math.min(Math.max(mpFeePct, 0), 99) / 100;
  const effectiveMarkup = markup / feeFactor;
  return Math.max(1, Math.ceil(effective * effectiveMarkup * creditsPerUsd));
}

