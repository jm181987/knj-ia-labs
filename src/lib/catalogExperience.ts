import type { WSCatalogModel } from "@/lib/wavespeedCatalog";
import { FEATURED_MODEL_SPECS } from "@/lib/featuredModels";

export type ObjectiveId =
  | "imageToVideo"
  | "textToVideo"
  | "createImage"
  | "editImage"
  | "talkingAvatar"
  | "upscale"
  | "removeObjects"
  | "createVoice";

export type ModelRequirement = "text" | "image" | "audio" | "video";

export type ObjectiveDefinition = {
  id: ObjectiveId;
  labelKey: string;
  descriptionKey: string;
  matches: (model: WSCatalogModel) => boolean;
};

function haystack(model: WSCatalogModel) {
  return `${model.model_id} ${model.name || ""} ${model.type} ${model.description || ""} ${model.api_path || ""}`.toLowerCase();
}

export const OBJECTIVES: ObjectiveDefinition[] = [
  {
    id: "imageToVideo",
    labelKey: "catalog.objectives.items.imageToVideo.title",
    descriptionKey: "catalog.objectives.items.imageToVideo.description",
    matches: (model) => model.type === "image-to-video",
  },
  {
    id: "textToVideo",
    labelKey: "catalog.objectives.items.textToVideo.title",
    descriptionKey: "catalog.objectives.items.textToVideo.description",
    matches: (model) => model.type === "text-to-video",
  },
  {
    id: "createImage",
    labelKey: "catalog.objectives.items.createImage.title",
    descriptionKey: "catalog.objectives.items.createImage.description",
    matches: (model) => model.type === "text-to-image",
  },
  {
    id: "editImage",
    labelKey: "catalog.objectives.items.editImage.title",
    descriptionKey: "catalog.objectives.items.editImage.description",
    matches: (model) => model.type === "image-to-image" || model.type === "image-effects",
  },
  {
    id: "talkingAvatar",
    labelKey: "catalog.objectives.items.talkingAvatar.title",
    descriptionKey: "catalog.objectives.items.talkingAvatar.description",
    matches: (model) => {
      const text = haystack(model);
      return (
        model.type === "digital-human" ||
        model.type === "portrait-transfer" ||
        text.includes("lip-sync") ||
        text.includes("lipsync") ||
        text.includes("infinite-talk") ||
        text.includes("infinitetalk")
      );
    },
  },
  {
    id: "upscale",
    labelKey: "catalog.objectives.items.upscale.title",
    descriptionKey: "catalog.objectives.items.upscale.description",
    matches: (model) => model.type === "upscaler",
  },
  {
    id: "removeObjects",
    labelKey: "catalog.objectives.items.removeObjects.title",
    descriptionKey: "catalog.objectives.items.removeObjects.description",
    matches: (model) => {
      const text = haystack(model);
      return model.type === "ai-remover" || text.includes("remove") || text.includes("eraser");
    },
  },
  {
    id: "createVoice",
    labelKey: "catalog.objectives.items.createVoice.title",
    descriptionKey: "catalog.objectives.items.createVoice.description",
    matches: (model) => {
      const text = haystack(model);
      return (
        model.type === "text-to-audio" &&
        (text.includes("voice") || text.includes("speech") || text.includes("tts") || text.includes("elevenlabs"))
      );
    },
  },
];

const FEATURED_QUERY_ORDER = FEATURED_MODEL_SPECS.flatMap((spec) => spec.queries.map((q) => q.toLowerCase()));

function featuredRank(model: WSCatalogModel) {
  const text = haystack(model);
  const index = FEATURED_QUERY_ORDER.findIndex((query) => text.includes(query));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function objectiveModels(models: WSCatalogModel[], objectiveId: ObjectiveId, limit = 4) {
  const objective = OBJECTIVES.find((item) => item.id === objectiveId);
  if (!objective) return [];
  return models
    .filter(objective.matches)
    .sort((a, b) => {
      const featured = featuredRank(a) - featuredRank(b);
      if (featured !== 0) return featured;
      return (b.sort_order || 0) - (a.sort_order || 0);
    })
    .slice(0, limit);
}

function requiredFieldNames(model: WSCatalogModel) {
  return new Set((model.request_schema?.required || []).map((item) => item.toLowerCase()));
}

export function getModelRequirements(model: WSCatalogModel): ModelRequirement[] {
  const required = requiredFieldNames(model);
  const props = model.request_schema?.properties || {};
  const keys = Object.keys(props).map((key) => key.toLowerCase());
  const allKeys = new Set([...required, ...keys]);
  const requirements: ModelRequirement[] = [];

  const needs = (patterns: string[]) => patterns.some((pattern) => Array.from(allKeys).some((key) => key.includes(pattern)));
  const requiredNeeds = (patterns: string[]) => patterns.some((pattern) => Array.from(required).some((key) => key.includes(pattern)));

  if (requiredNeeds(["prompt", "text", "instruction", "script"]) || model.type.startsWith("text-to-")) requirements.push("text");
  if (requiredNeeds(["image", "photo", "portrait", "reference"]) || (model.type.includes("image-to-") && needs(["image", "photo", "reference"]))) requirements.push("image");
  if (requiredNeeds(["audio", "voice", "speech", "sound"])) requirements.push("audio");
  if (requiredNeeds(["video", "clip"])) requirements.push("video");

  return Array.from(new Set(requirements));
}

const SEARCH_INTENTS: Array<{ terms: string[]; matches: (model: WSCatalogModel) => boolean }> = [
  { terms: ["animar foto", "animar imagen", "foto a video", "imagen a video"], matches: (m) => m.type === "image-to-video" },
  { terms: ["texto a video", "crear video", "generar video"], matches: (m) => m.type === "text-to-video" },
  { terms: ["crear imagen", "generar imagen", "crear logo", "hacer logo", "logo"], matches: (m) => m.type === "text-to-image" || m.type === "image-to-image" },
  { terms: ["editar foto", "editar imagen", "cambiar fondo", "reemplazar fondo"], matches: (m) => m.type === "image-to-image" || m.type === "image-effects" },
  { terms: ["hacer hablar", "avatar hablante", "lip sync", "lipsync"], matches: (m) => OBJECTIVES.find((o) => o.id === "talkingAvatar")!.matches(m) },
  { terms: ["mejorar calidad", "aumentar calidad", "upscale", "escalar imagen", "mejorar resolucion", "mejorar resolución"], matches: (m) => m.type === "upscaler" },
  { terms: ["quitar fondo", "eliminar objeto", "borrar objeto", "remove object", "remover objeto"], matches: (m) => OBJECTIVES.find((o) => o.id === "removeObjects")!.matches(m) },
  { terms: ["crear voz", "voz ia", "texto a voz", "tts", "narracion", "narración"], matches: (m) => OBJECTIVES.find((o) => o.id === "createVoice")!.matches(m) },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function matchesCatalogSearch(model: WSCatalogModel, query: string) {
  const q = normalize(query);
  if (!q) return true;

  const text = normalize(haystack(model));
  if (text.includes(q)) return true;

  return SEARCH_INTENTS.some(
    (intent) => intent.terms.some((term) => q.includes(normalize(term)) || normalize(term).includes(q)) && intent.matches(model),
  );
}
