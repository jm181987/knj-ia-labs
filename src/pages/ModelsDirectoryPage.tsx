import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Boxes, Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, fetchCatalog, getBrand, prettyName, type WSCatalogModel } from "@/lib/wavespeedCatalog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import knjLogo from "@/assets/knj-logo.png";
import fluxLogo from "@/assets/logos/flux.png";
import geminiLogo from "@/assets/logos/gemini.png";
import googleLogo from "@/assets/logos/google.png";
import hailuoLogo from "@/assets/logos/hailuo.png";
import higgsfieldLogo from "@/assets/logos/higgsfield.png";
import klingLogo from "@/assets/logos/kling.png";
import ltxvLogo from "@/assets/logos/ltxv.png";
import nanoBananaLogo from "@/assets/logos/nano-banana.png";
import openaiLogo from "@/assets/logos/openai.png";
import seedanceLogo from "@/assets/logos/seedance.png";
import seedreamLogo from "@/assets/logos/seedream.png";
import wanLogo from "@/assets/logos/wan.png";
import wavespeedLogo from "@/assets/logos/wavespeed.png";

const getInitials = (brand: string) =>
  brand
    .split(/\s|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AI";

const typeKey = (type: string) => type.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase();

const PROVIDER_LOGOS: Record<string, string> = {
  alibaba: wanLogo,
  "black-forest-labs": fluxLogo,
  bytedance: seedanceLogo,
  gemini: geminiLogo,
  google: googleLogo,
  hailuo: hailuoLogo,
  higgsfield: higgsfieldLogo,
  kling: klingLogo,
  kwaivgi: klingLogo,
  ltxv: ltxvLogo,
  minimax: hailuoLogo,
  "nano-banana": nanoBananaLogo,
  openai: openaiLogo,
  seedance: seedanceLogo,
  seedream: seedreamLogo,
  wan: wanLogo,
  "wavespeed-ai": wavespeedLogo,
};

function getProviderLogo(modelId: string, brand: string) {
  const source = `${modelId} ${brand}`.toLowerCase();
  const slug = modelId.split("/")[0]?.toLowerCase();
  if (slug && PROVIDER_LOGOS[slug]) return PROVIDER_LOGOS[slug];
  return Object.entries(PROVIDER_LOGOS).find(([key]) => source.includes(key))?.[1] || null;
}

function categoryFor(model: WSCatalogModel) {
  return CATEGORIES.find((category) => category.id !== "all" && category.match(model.type)) || CATEGORIES[0];
}

function ProviderLogo({ brand, modelId }: { brand: string; modelId: string }) {
  const logo = getProviderLogo(modelId, brand);

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-primary/25 bg-card shadow-elegant">
      {logo ? (
        <img src={logo} alt={brand} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="font-mono-tech text-[11px] font-bold text-primary">{getInitials(brand)}</span>
      )}
    </div>
  );
}

function useVisibleOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);

  return { ref, visible };
}

function ModelCard({ model }: { model: WSCatalogModel }) {
  const { t, i18n } = useTranslation();
  const { ref, visible } = useVisibleOnce<HTMLDivElement>();
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const brand = getBrand(model.model_id);
  const category = categoryFor(model);
  const lang = (i18n.language || "es").slice(0, 2);

  useEffect(() => {
    setTranslatedDescription(null);
    if (!visible || lang === "en" || !model.description) return;

    let cancelled = false;
    supabase.functions
      .invoke("translate-model", {
        body: {
          model_id: model.model_id,
          lang,
          description: model.description,
          fields: {},
        },
      })
      .then(({ data }) => {
        if (!cancelled && data?.code === 0 && data?.data?.description) {
          setTranslatedDescription(data.data.description);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [lang, model.description, model.model_id, visible]);

  return (
    <div ref={ref} className="grid gap-4 border-b border-border/60 p-4 last:border-b-0 lg:grid-cols-[210px_minmax(220px,1fr)_150px_220px_minmax(320px,1.4fr)]">
      <div className="flex items-center gap-3">
        <ProviderLogo brand={brand} />
        <div className="min-w-0">
          <p className="font-medium text-foreground">{brand}</p>
          <p className="text-xs text-muted-foreground">{category.emoji} {t(`catalog.cat.${category.id}`, category.label)}</p>
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-medium text-foreground">{model.name || prettyName(model.model_id)}</p>
        <p className="mt-1 break-all font-mono-tech text-[11px] text-muted-foreground">{model.model_id}</p>
      </div>
      <div>
        <Badge variant="outline" className="rounded-sm font-mono-tech text-[10px] uppercase tracking-wider">
          {model.type}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {t(`modelsDirectory.uses.${typeKey(model.type)}`, t("modelsDirectory.uses.generic"))}
      </p>
      <p className="whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">
        {translatedDescription || model.description || t("modelsDirectory.noDescription")}
      </p>
    </div>
  );
}

function ModelRows({ models }: { models: WSCatalogModel[] }) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="hidden border-b border-border/70 bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[210px_minmax(220px,1fr)_150px_220px_minmax(320px,1.4fr)]">
        <span>{t("modelsDirectory.provider")}</span>
        <span>{t("modelsDirectory.model")}</span>
        <span>{t("modelsDirectory.type")}</span>
        <span>{t("modelsDirectory.use")}</span>
        <span>{t("modelsDirectory.description")}</span>
      </div>
      {models.map((model) => <ModelCard key={model.model_id} model={model} />)}
    </div>
  );
}

export default function ModelsDirectoryPage() {
  const { t } = useTranslation();
  const [models, setModels] = useState<WSCatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let active = true;
    fetchCatalog()
      .then((list) => active && setModels(list))
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const selected = CATEGORIES.find((item) => item.id === category) || CATEGORIES[0];

    return models
      .filter((model) => selected.match(model.type))
      .filter((model) => {
        if (!q) return true;
        return [model.model_id, model.name, model.type, model.description, getBrand(model.model_id)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const catA = categoryFor(a).id.localeCompare(categoryFor(b).id);
        if (catA !== 0) return catA;
        return (b.sort_order || 0) - (a.sort_order || 0);
      });
  }, [category, models, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of CATEGORIES) map[item.id] = models.filter((model) => item.match(model.type)).length;
    return map;
  }, [models]);

  const grouped = useMemo(() => {
    return CATEGORIES.filter((item) => item.id !== "all")
      .map((item) => ({ ...item, models: filtered.filter((model) => item.match(model.type)) }))
      .filter((item) => item.models.length > 0);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={knjLogo} alt="KNJ PRO" className="h-11 w-11 object-contain" />
            <span className="hidden font-bold tracking-tight sm:inline">KNJ<span className="text-gradient"> PRO</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/">
              <Button variant="ghost" size="sm">{t("modelsDirectory.backLanding")}</Button>
            </Link>
            <Link to="/app">
              <Button size="sm" className="gap-1.5">
                {t("common.start")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section className="relative overflow-hidden border-b border-border/60 pb-8">
          <div className="inline-flex items-center gap-2 rounded-sm border border-primary/30 bg-primary/10 px-3 py-1 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("modelsDirectory.badge", { count: models.length || "900+" })}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <h1 className="font-display text-4xl font-extrabold leading-none sm:text-6xl">
                {t("modelsDirectory.title1")} <span className="text-gradient">{t("modelsDirectory.titleHighlight")}</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("modelsDirectory.subtitle")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono-tech text-xs">
              <div className="border border-border/70 bg-card/50 p-4">
                <p className="text-muted-foreground">{t("modelsDirectory.totalModels")}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{loading ? "…" : filtered.length}</p>
              </div>
              <div className="border border-border/70 bg-card/50 p-4">
                <p className="text-muted-foreground">{t("modelsDirectory.categories")}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{CATEGORIES.length - 1}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("modelsDirectory.searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Link to="/app/catalog">
              <Button variant="outline" className="w-full gap-2 lg:w-auto">
                <Boxes className="h-4 w-4" />
                {t("modelsDirectory.openCatalog")}
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={category === item.id ? "default" : "outline"}
                onClick={() => setCategory(item.id)}
                className="rounded-sm"
              >
                <span className="mr-1.5">{item.emoji}</span>
                {t(`catalog.cat.${item.id}`, item.label)}
                {!loading && <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">{counts[item.id] || 0}</Badge>}
              </Button>
            ))}
          </div>
        </section>

        {error && <div className="border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : category === "all" ? (
          <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h2 className="font-display text-2xl font-bold">
                    <span className="mr-2">{group.emoji}</span>{t(`catalog.cat.${group.id}`, group.label)}
                  </h2>
                  <Badge variant="secondary" className="rounded-sm">{group.models.length}</Badge>
                </div>
                <div className="overflow-hidden border border-border/70 bg-card/35">
                  <ModelRows models={group.models} />
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden border border-border/70 bg-card/35">
            <ModelRows models={filtered} />
          </div>
        )}
      </main>
    </div>
  );
}
