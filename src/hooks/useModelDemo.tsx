import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapDbType } from "@/lib/wavespeedCatalog";

export type ModelDemo = {
  url: string;
  kind: "image" | "video";
} | null;

// Cache en memoria por sesión: model_id -> demo
const demoCache = new Map<string, ModelDemo>();
const inflight = new Map<string, Promise<ModelDemo>>();

function pickFirstUrl(result_urls: unknown): string | null {
  if (!result_urls) return null;
  if (Array.isArray(result_urls)) {
    for (const u of result_urls) {
      if (typeof u === "string" && u.startsWith("http")) return u;
      if (u && typeof u === "object" && typeof (u as any).url === "string") return (u as any).url;
    }
  }
  if (typeof result_urls === "string" && result_urls.startsWith("http")) return result_urls;
  return null;
}

async function loadDemo(model_id: string, wsType: string): Promise<ModelDemo> {
  if (demoCache.has(model_id)) return demoCache.get(model_id)!;
  const existing = inflight.get(model_id);
  if (existing) return existing;

  const promise = (async (): Promise<ModelDemo> => {
    // model_id puede venir como "google/veo3.1/text-to-video" pero en DB se guarda como
    // modelLabel (prettyName) o modelPath. Probamos primero por modelo exacto, luego por path.
    const variants = [model_id, model_id.replace(/^\/api\/v3\//, "")];

    const { data } = await supabase
      .from("generations")
      .select("result_urls, model")
      .in("model", variants)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const url = pickFirstUrl(data?.result_urls);
    if (!url) {
      demoCache.set(model_id, null);
      return null;
    }
    const kind = mapDbType(wsType) === "video" ? "video" : "image";
    const demo: ModelDemo = { url, kind };
    demoCache.set(model_id, demo);
    return demo;
  })();

  inflight.set(model_id, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(model_id);
  }
}

export function useModelDemo(model_id: string | undefined, wsType: string | undefined, enabled = true) {
  const [demo, setDemo] = useState<ModelDemo>(model_id ? demoCache.get(model_id) ?? null : null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (!model_id || !wsType) return;
    if (demoCache.has(model_id)) {
      setDemo(demoCache.get(model_id)!);
      return;
    }
    let active = true;
    setLoading(true);
    loadDemo(model_id, wsType)
      .then((d) => active && setDemo(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [model_id, wsType, enabled]);

  return { demo, loading };
}
