import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WSCatalogModel } from "@/lib/wavespeedCatalog";

export type ModelTranslation = {
  description: string;
  field_labels: Record<string, string>;
  field_descriptions: Record<string, string>;
};

// ============================================================
// Traducción usando la API nativa del navegador (Translator API).
// Disponible en Chrome 138+ con flag o en builds estables recientes.
// Si no está disponible, devolvemos el texto original (fallback).
// ============================================================

const LS_FULL_KEY = "model_tr_full_v2";
const LS_CARD_KEY = "model_tr_card_v2";
const LS_MAX_ENTRIES = 300;

function loadLS<T>(key: string): Map<string, T> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, T>));
  } catch {
    return new Map();
  }
}

function saveLS<T>(key: string, map: Map<string, T>) {
  try {
    if (typeof localStorage === "undefined") return;
    let entries = Array.from(map.entries());
    if (entries.length > LS_MAX_ENTRIES) entries = entries.slice(-LS_MAX_ENTRIES);
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ignore quota
  }
}

const fullCache = loadLS<ModelTranslation>(LS_FULL_KEY);
const cardCache = loadLS<string>(LS_CARD_KEY);

// Translator instances cached per language pair
const translatorCache = new Map<string, Promise<any | null>>();

function getTranslator(targetLang: string): Promise<any | null> {
  const key = `en:${targetLang}`;
  if (translatorCache.has(key)) return translatorCache.get(key)!;
  const w: any = typeof window !== "undefined" ? window : {};
  const TranslatorCtor = w.Translator;
  if (!TranslatorCtor || typeof TranslatorCtor.create !== "function") {
    const p = Promise.resolve(null);
    translatorCache.set(key, p);
    return p;
  }
  const p = (async () => {
    try {
      const availability =
        typeof TranslatorCtor.availability === "function"
          ? await TranslatorCtor.availability({ sourceLanguage: "en", targetLanguage: targetLang })
          : "available";
      if (availability === "unavailable") return null;
      const t = await TranslatorCtor.create({ sourceLanguage: "en", targetLanguage: targetLang });
      return t;
    } catch {
      return null;
    }
  })();
  translatorCache.set(key, p);
  return p;
}

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text) return text;
  const t = await getTranslator(targetLang);
  if (!t) return text;
  try {
    return await t.translate(text);
  } catch {
    return text;
  }
}

function buildFieldsFromModel(model: WSCatalogModel) {
  const labels: Record<string, string> = {};
  const descriptions: Record<string, string> = {};
  const props = model.request_schema?.properties || {};
  for (const [k, p] of Object.entries(props)) {
    if ((p as any)["x-hidden"]) continue;
    labels[k] = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    descriptions[k] = (p as any).description || "";
  }
  return { labels, descriptions };
}

async function translateFullModel(model: WSCatalogModel, lang: string): Promise<ModelTranslation> {
  const key = `${lang}:${model.model_id}`;
  if (fullCache.has(key)) return fullCache.get(key)!;

  const { labels, descriptions } = buildFieldsFromModel(model);
  const description = await translateText(model.description || "", lang);

  const field_labels: Record<string, string> = {};
  const field_descriptions: Record<string, string> = {};
  for (const k of Object.keys(labels)) {
    field_labels[k] = await translateText(labels[k], lang);
    if (descriptions[k]) {
      field_descriptions[k] = await translateText(descriptions[k], lang);
    } else {
      field_descriptions[k] = "";
    }
  }

  const result: ModelTranslation = { description, field_labels, field_descriptions };
  fullCache.set(key, result);
  saveLS(LS_FULL_KEY, fullCache);
  return result;
}

export function useModelTranslation(model: WSCatalogModel | null, enabled = true) {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "es").slice(0, 2);
  const [translation, setTranslation] = useState<ModelTranslation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setTranslation(null);
      setLoading(false);
      return;
    }

    if (!model) {
      setTranslation(null);
      return;
    }

    // Pasarela para EN: no traducir
    if (lang === "en") {
      const { labels, descriptions } = buildFieldsFromModel(model);
      setTranslation({
        description: model.description || "",
        field_labels: labels,
        field_descriptions: descriptions,
      });
      return;
    }

    const key = `${lang}:${model.model_id}`;
    if (fullCache.has(key)) {
      setTranslation(fullCache.get(key)!);
      return;
    }

    let cancelled = false;
    setLoading(true);
    translateFullModel(model, lang)
      .then((r) => {
        if (!cancelled) setTranslation(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [model, lang, enabled]);

  return { translation, loading };
}

// Pre-warm: ya no es necesario porque la API nativa es local y rápida.
// Lo dejamos como no-op para no romper imports existentes.
export function usePrewarmTopModels(_models: WSCatalogModel[], _topN = 8, _concurrency = 1) {
  useEffect(() => {
    // no-op
  }, []);
}

// Hook ligero: ya NO pretraduce las tarjetas del catálogo (era muy costoso
// con 800+ modelos). Solo devuelve traducciones que ya estén cacheadas.
// Las traducciones reales se hacen al abrir el modal de cada modelo.
export function useTranslatedDescriptions(models: WSCatalogModel[]) {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "es").slice(0, 2);
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lang === "en") {
      setMap((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const cached: Record<string, string> = {};
    for (const m of models) {
      const key = `${lang}:${m.model_id}`;
      if (cardCache.has(key)) cached[m.model_id] = cardCache.get(key)!;
    }
    setMap(cached);
  }, [models, lang]);

  return map;
}
