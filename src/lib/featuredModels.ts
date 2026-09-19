import type { WSCatalogModel } from "@/lib/wavespeedCatalog";

export type FeaturedGroup = "all" | "video" | "image" | "edit" | "avatar" | "audio";

export type FeaturedModelSpec = {
  id: string;
  group: Exclude<FeaturedGroup, "all">;
  queries: string[];
  title?: string;
  badgeKey: string;
  strengthKey: string;
};

export type ResolvedFeaturedModel = {
  spec: FeaturedModelSpec;
  model: WSCatalogModel;
};

export const FEATURED_MODEL_SPECS: FeaturedModelSpec[] = [
  {
    id: "kling-3",
    group: "video",
    queries: [
      "kwaivgi/kling-v3.0-std/text-to-video",
      "kling-v3.0-std/text-to-video",
      "kling-v3.0-std",
      "kling-v3.0",
    ],
    title: "Kling 3.0",
    badgeKey: "catalog.featuredViewer.badges.cinematic",
    strengthKey: "catalog.featuredViewer.strengths.kling",
  },
  {
    id: "seedance-2-5",
    group: "video",
    queries: [
      "bytedance/seedance-2.5/text-to-video-turbo",
      "bytedance/seedance-2.5/text-to-video",
      "seedance-2.5/text-to-video",
      "seedance-2.5",
    ],
    title: "Seedance 2.5",
    badgeKey: "catalog.featuredViewer.badges.balanced",
    strengthKey: "catalog.featuredViewer.strengths.seedance",
  },
  {
    id: "veo-3-1",
    group: "video",
    queries: [
      "google/veo3.1/text-to-video",
      "google/veo-3.1/text-to-video",
      "veo3.1",
      "veo-3.1",
    ],
    title: "Veo 3.1",
    badgeKey: "catalog.featuredViewer.badges.audiovisual",
    strengthKey: "catalog.featuredViewer.strengths.veo",
  },
  {
    id: "nano-banana-2",
    group: "image",
    queries: [
      "google/nano-banana-2/text-to-image",
      "google/nano-banana-pro/text-to-image",
      "google/nano-banana/text-to-image",
    ],
    title: "Nano Banana",
    badgeKey: "catalog.featuredViewer.badges.fast",
    strengthKey: "catalog.featuredViewer.strengths.nanoBanana",
  },
  {
    id: "seedream-5",
    group: "image",
    queries: [
      "bytedance/seedream-v5.0-pro",
      "bytedance/seedream-v5.0-lite",
      "seedream-v5.0",
      "seedream-5",
      "seedream-4.5",
    ],
    title: "Seedream 5",
    badgeKey: "catalog.featuredViewer.badges.design",
    strengthKey: "catalog.featuredViewer.strengths.seedream",
  },
  {
    id: "nano-banana-edit",
    group: "edit",
    queries: [
      "google/nano-banana-pro/edit",
      "google/nano-banana-2/edit",
      "google/nano-banana/edit",
    ],
    title: "Nano Banana Edit",
    badgeKey: "catalog.featuredViewer.badges.precision",
    strengthKey: "catalog.featuredViewer.strengths.nanoBananaEdit",
  },
  {
    id: "seedance-edit",
    group: "edit",
    queries: [
      "bytedance/seedance-2.5/video-edit-turbo",
      "bytedance/seedance-2.5/video-edit",
      "seedance-2.5/video-edit",
    ],
    title: "Seedance Video Edit",
    badgeKey: "catalog.featuredViewer.badges.videoEdit",
    strengthKey: "catalog.featuredViewer.strengths.seedanceEdit",
  },
  {
    id: "infinite-talk",
    group: "avatar",
    queries: [
      "wavespeed-ai/infinitetalk",
      "infinite-talk",
      "infinitetalk",
    ],
    title: "InfiniteTalk",
    badgeKey: "catalog.featuredViewer.badges.avatar",
    strengthKey: "catalog.featuredViewer.strengths.infiniteTalk",
  },
  {
    id: "elevenlabs",
    group: "audio",
    queries: [
      "elevenlabs/multilingual-v2",
      "elevenlabs",
    ],
    title: "ElevenLabs",
    badgeKey: "catalog.featuredViewer.badges.voice",
    strengthKey: "catalog.featuredViewer.strengths.elevenLabs",
  },
];

function modelHaystack(model: WSCatalogModel) {
  return `${model.model_id} ${model.name || ""} ${model.api_path || ""}`.toLowerCase();
}

function matchScore(model: WSCatalogModel, spec: FeaturedModelSpec): number {
  const haystack = modelHaystack(model);
  const queryIndex = spec.queries.findIndex((query) => haystack.includes(query.toLowerCase()));
  if (queryIndex === -1) return -1;

  // Prioriza el endpoint más específico definido en la configuración.
  const queryScore = (spec.queries.length - queryIndex) * 1000;
  return queryScore + (model.sort_order || 0);
}

export function resolveFeaturedModels(models: WSCatalogModel[]): ResolvedFeaturedModel[] {
  const used = new Set<string>();
  const resolved: ResolvedFeaturedModel[] = [];

  for (const spec of FEATURED_MODEL_SPECS) {
    const match = models
      .filter((model) => !used.has(model.model_id))
      .map((model) => ({ model, score: matchScore(model, spec) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score)[0]?.model;

    if (!match) continue;
    used.add(match.model_id);
    resolved.push({ spec, model: match });
  }

  return resolved;
}
