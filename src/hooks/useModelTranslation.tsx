import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { WSCatalogModel } from "@/lib/wavespeedCatalog";

export type ModelTranslation = {
  description: string;
  field_labels: Record<string, string>;
  field_descriptions: Record<string, string>;
};

// Cache persistente en localStorage + memoria
const LS_FULL_KEY = "model_tr_full_v1";
const LS_CARD_KEY = "model_tr_card_v1";
const LS_MAX_ENTRIES = 200;

function loadLS<T>(key: string): Map<string, T> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, T>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveLS<T>(key: string, map: Map<string, T>) {
  try {
    if (typeof localStorage === "undefined") return;
    // Limitar tamaño: conservar las últimas LS_MAX_ENTRIES
    let entries = Array.from(map.entries());
    if (entries.length > LS_MAX_ENTRIES) {
      entries = entries.slice(-LS_MAX_ENTRIES);
    }
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // quota exceeded u otro: ignorar
  }
}

const memCache = loadLS<ModelTranslation>(LS_FULL_KEY);
const inflight = new Map<string, Promise<ModelTranslation | null>>();

// Backoff global: cuando recibimos rate_limited, pausamos nuevas llamadas hasta este timestamp
let rateLimitedUntil = 0;
function isRateLimited() {
  return Date.now() < rateLimitedUntil;
}
function markRateLimited(ms = 30000) {
  rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + ms);
}

function setMemCache(key: string, value: ModelTranslation) {
  memCache.set(key, value);
  saveLS(LS_FULL_KEY, memCache);
}

export function useModelTranslation(model: WSCatalogModel | null) {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "es").slice(0, 2);
  const [translation, setTranslation] = useState<ModelTranslation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!model) {
      setTranslation(null);
      return;
    }
    const key = `${lang}:${model.model_id}`;
    if (memCache.has(key)) {
      setTranslation(memCache.get(key)!);
      return;
    }

    // Si idioma EN, no hace falta llamar
    if (lang === "en") {
      const passthrough: ModelTranslation = {
        description: model.description || "",
        field_labels: {},
        field_descriptions: {},
      };
      memCache.set(key, passthrough);
      setTranslation(passthrough);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      try {
        if (isRateLimited()) {
          setTranslation(null);
          return;
        }
        let promise = inflight.get(key);
        if (!promise) {
          const fields: Record<string, { label?: string; description?: string }> = {};
          const props = model.request_schema?.properties || {};
          for (const [k, p] of Object.entries(props)) {
            if (p["x-hidden"]) continue;
            fields[k] = {
              label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              description: p.description || "",
            };
          }
          promise = supabase.functions
            .invoke("translate-model", {
              body: {
                model_id: model.model_id,
                lang,
                description: model.description || "",
                fields,
              },
            })
            .then(({ data, error }) => {
              if (error || !data || data.code !== 0) {
                if (data?.message === "rate_limited") markRateLimited();
                return null;
              }
              return data.data as ModelTranslation;
            });
          inflight.set(key, promise);
          promise.finally(() => inflight.delete(key));
        }
        const result = await promise;
        if (cancelled) return;
        if (result) {
          setMemCache(key, result);
          setTranslation(result);
        } else {
          setTranslation(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [model, lang]);

  return { translation, loading };
}

// Helper interno: traduce un modelo completo (descripción + fields) y guarda en memCache
async function translateFullModel(model: WSCatalogModel, lang: string): Promise<ModelTranslation | null> {
  const key = `${lang}:${model.model_id}`;
  if (memCache.has(key)) return memCache.get(key)!;
  if (isRateLimited()) return null;
  let promise = inflight.get(key);
  if (!promise) {
    const fields: Record<string, { label?: string; description?: string }> = {};
    const props = model.request_schema?.properties || {};
    for (const [k, p] of Object.entries(props)) {
      if ((p as any)["x-hidden"]) continue;
      fields[k] = {
        label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: (p as any).description || "",
      };
    }
    promise = supabase.functions
      .invoke("translate-model", {
        body: {
          model_id: model.model_id,
          lang,
          description: model.description || "",
          fields,
        },
      })
      .then(({ data, error }) => {
        if (error || !data || data.code !== 0) {
          if (data?.message === "rate_limited") markRateLimited();
          return null;
        }
        return data.data as ModelTranslation;
      });
    inflight.set(key, promise);
    promise.finally(() => inflight.delete(key));
  }
  const result = await promise;
  if (result) setMemCache(key, result);
  return result;
}

// Pre-calienta en background los top N modelos por sort_order para el idioma activo.
// No bloquea la UI; respeta la cache existente y limita concurrencia.
export function usePrewarmTopModels(models: WSCatalogModel[], topN = 8, concurrency = 1) {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "es").slice(0, 2);

  useEffect(() => {
    if (lang === "en" || !models.length) return;
    const top = [...models]
      .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0))
      .slice(0, topN)
      .filter((m) => !memCache.has(`${lang}:${m.model_id}`));
    if (!top.length) return;

    let cancelled = false;
    let i = 0;
    const worker = async () => {
      while (!cancelled && i < top.length) {
        const m = top[i++];
        try {
          await translateFullModel(m, lang);
        } catch {
          // silencioso
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    };
    // Pequeño delay para no competir con la carga inicial
    const t = setTimeout(() => {
      Promise.all(Array.from({ length: concurrency }, worker));
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [models, lang, topN, concurrency]);
}

// Hook para traducir solo descripciones de tarjetas (sin fields) — más liviano
const cardCache = loadLS<string>(LS_CARD_KEY);
const cardInflight = new Map<string, Promise<string | null>>();

function setCardCache(key: string, value: string) {
  cardCache.set(key, value);
  saveLS(LS_CARD_KEY, cardCache);
}

export function useTranslatedDescriptions(models: WSCatalogModel[]) {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "es").slice(0, 2);
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lang === "en") {
      setMap((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    let cancelled = false;
    const next: Record<string, string> = {};
    const toFetch: WSCatalogModel[] = [];
    for (const m of models) {
      const key = `${lang}:${m.model_id}`;
      if (cardCache.has(key)) {
        next[m.model_id] = cardCache.get(key)!;
      } else if (m.description) {
        toFetch.push(m);
      }
    }
    setMap((prev) => {
      const keys = Object.keys(next);
      if (
        keys.length === Object.keys(prev).length &&
        keys.every((k) => prev[k] === next[k])
      ) {
        return prev;
      }
      return next;
    });

    // Fetch en paralelo limitado (de 5 en 5) para no saturar
    const run = async () => {
      const concurrency = 5;
      let i = 0;
      const worker = async () => {
        while (i < toFetch.length) {
          const m = toFetch[i++];
          const key = `${lang}:${m.model_id}`;
          let p = cardInflight.get(key);
          if (!p) {
            p = supabase.functions
              .invoke("translate-model", {
                body: {
                  model_id: m.model_id,
                  lang,
                  description: m.description || "",
                  fields: {},
                },
              })
              .then(({ data, error }) => {
                if (error || !data || data.code !== 0) return null;
                return (data.data as ModelTranslation).description || null;
              });
            cardInflight.set(key, p);
            p.finally(() => cardInflight.delete(key));
          }
          const desc = await p;
          if (cancelled) return;
          if (desc) {
            setCardCache(key, desc);
            setMap((prev) => ({ ...prev, [m.model_id]: desc }));
          }
        }
      };
      await Promise.all(Array.from({ length: concurrency }, worker));
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [models, lang]);

  return map;
}
