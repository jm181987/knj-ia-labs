import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { WSCatalogModel } from "@/lib/wavespeedCatalog";

export type ModelTranslation = {
  description: string;
  field_labels: Record<string, string>;
  field_descriptions: Record<string, string>;
};

// Cache en memoria por sesión
const memCache = new Map<string, ModelTranslation>();
const inflight = new Map<string, Promise<ModelTranslation | null>>();

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
              if (error || !data || data.code !== 0) return null;
              return data.data as ModelTranslation;
            });
          inflight.set(key, promise);
          promise.finally(() => inflight.delete(key));
        }
        const result = await promise;
        if (cancelled) return;
        if (result) {
          memCache.set(key, result);
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
        if (error || !data || data.code !== 0) return null;
        return data.data as ModelTranslation;
      });
    inflight.set(key, promise);
    promise.finally(() => inflight.delete(key));
  }
  const result = await promise;
  if (result) memCache.set(key, result);
  return result;
}

// Pre-calienta en background los top N modelos por sort_order para el idioma activo.
// No bloquea la UI; respeta la cache existente y limita concurrencia.
export function usePrewarmTopModels(models: WSCatalogModel[], topN = 20, concurrency = 3) {
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
const cardCache = new Map<string, string>();
const cardInflight = new Map<string, Promise<string | null>>();

export function useTranslatedDescriptions(models: WSCatalogModel[]) {
  const { i18n } = useTranslation();
  const lang = (i18n.language || "es").slice(0, 2);
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lang === "en") {
      setMap({});
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
    setMap(next);

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
            cardCache.set(key, desc);
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
