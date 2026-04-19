import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Sparkles, Wand2, Library, Coins } from "lucide-react";
import { fetchCatalog, CATEGORIES, getBrand, prettyName, submitDynamic, getPricingSettings, computeModelCost, type WSCatalogModel } from "@/lib/wavespeedCatalog";
import { DynamicSchemaForm } from "@/components/DynamicSchemaForm";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useModelTranslation, useTranslatedDescriptions, usePrewarmTopModels } from "@/hooks/useModelTranslation";
import { useModelDemo } from "@/hooks/useModelDemo";
import { ImageOff } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function CatalogPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [models, setModels] = useState<WSCatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pricing, setPricing] = useState<{ markup: number; creditsPerUsd: number; mpFeePct: number }>({ markup: 3, creditsPerUsd: 37, mpFeePct: 7.99 });
  const category = searchParams.get("cat") || "all";
  const setCategory = (id: string) => {
    if (id === "all") setSearchParams({});
    else setSearchParams({ cat: id });
  };
  const [openModel, setOpenModel] = useState<WSCatalogModel | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPricingSettings().then(setPricing).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCatalog()
      .then((list) => active && setModels(list))
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Pre-traduce en background los top 20 modelos para abrir el modal sin espera
  usePrewarmTopModels(models, 20, 3);

  const filtered = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.id === category)!;
    const q = search.trim().toLowerCase();
    return models
      .filter((m) => cat.match(m.type))
      .filter((m) => {
        if (!q) return true;
        return (
          m.model_id.toLowerCase().includes(q) ||
          (m.description || "").toLowerCase().includes(q) ||
          getBrand(m.model_id).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
  }, [models, search, category]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of CATEGORIES) map[c.id] = models.filter((m) => c.match(m.type)).length;
    return map;
  }, [models]);

  const onOpen = (m: WSCatalogModel) => {
    setOpenModel(m);
    setValues({});
  };

  const handleGenerate = async () => {
    if (!openModel) return;
    const required = openModel.request_schema.required || [];
    for (const r of required) {
      if (values[r] === undefined || values[r] === "" || (Array.isArray(values[r]) && (values[r] as unknown[]).length === 0)) {
        toast({ title: t("catalog.missingField", { field: r }), variant: "destructive" });
        return;
      }
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await submitDynamic({ model: openModel, values, userId: user?.id });
      if (res.code !== 0 || !res.data) throw new Error(res.message || t("catalog.submitError"));
      toast({ title: t("catalog.generating"), description: t("catalog.generatingDesc") });
      setOpenModel(null);
      navigate("/app/history");
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        {/* animated grid */}
        <div className="hero-grid" />
        {/* animated aurora blobs */}
        <div
          className="hero-blob"
          style={{
            top: "-20%",
            left: "10%",
            width: "55%",
            height: "120%",
            background: "radial-gradient(circle, hsl(var(--primary) / 0.55), transparent 60%)",
            animation: "hero-blob-a 14s ease-in-out infinite",
          }}
        />
        <div
          className="hero-blob"
          style={{
            top: "-10%",
            right: "-5%",
            width: "50%",
            height: "120%",
            background: "radial-gradient(circle, hsl(var(--primary-glow) / 0.45), transparent 60%)",
            animation: "hero-blob-b 16s ease-in-out infinite",
          }}
        />
        {/* shine sweep */}
        <div className="hero-shine" />

        <div className="relative px-6 py-12 sm:py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-medium mb-5 backdrop-blur-sm animate-fade-in">
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            {t("catalog.heroBadge")}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] animate-fade-in">
            {t("catalog.heroTitle1")}{" "}
            <span className="text-gradient">{t("catalog.heroTitleHighlight")}</span>
            <br className="hidden sm:block" /> {t("catalog.heroTitle2")}
          </h1>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto animate-fade-in">
            {t("catalog.heroSub")}
          </p>
        </div>
      </section>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("catalog.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {/* Categorías */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={category === c.id ? "default" : "outline"}
            onClick={() => setCategory(c.id)}
            className="rounded-full"
          >
            <span className="mr-1.5">{c.emoji}</span>
            {t(`catalog.cat.${c.id}`, c.label)}
            {!loading && <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">{counts[c.id] ?? 0}</Badge>}
          </Button>
        ))}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <CatalogList
          filtered={filtered}
          pricing={pricing}
          onOpen={onOpen}
          t={t}
        />
      )}

      {/* Modal de generación */}
      <Dialog open={!!openModel} onOpenChange={(o) => !o && setOpenModel(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          {openModel && (
            <ModelDialogContent
              openModel={openModel}
              values={values}
              setValues={setValues}
              pricing={pricing}
              submitting={submitting}
              setOpenModel={setOpenModel}
              handleGenerate={handleGenerate}
              t={t}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Sub-componentes con traducción dinámica =====

function CatalogList({
  filtered,
  pricing,
  onOpen,
  t,
}: {
  filtered: WSCatalogModel[];
  pricing: { markup: number; creditsPerUsd: number; mpFeePct: number };
  onOpen: (m: WSCatalogModel) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const visible = filtered.slice(0, 200);
  const translatedDescs = useTranslatedDescriptions(visible);
  return (
    <>
      <p className="text-sm text-muted-foreground">{t("catalog.modelsCount", { count: filtered.length })}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((m) => {
          const desc = translatedDescs[m.model_id] || m.description || t("catalog.noDescription");
          return (
            <Card key={m.model_id} className="hover:border-primary/50 transition-colors flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{prettyName(m.model_id)}</CardTitle>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{getBrand(m.model_id)}</Badge>
                </div>
                <CardDescription className="text-xs line-clamp-3">{desc}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-2 flex-1 flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{m.type}</Badge>
                <Badge variant="outline" className="text-[10px] gap-1 border-primary/40 text-primary">
                  <Coins className="h-2.5 w-2.5" />
                  {computeModelCost(m.base_price, pricing.markup, pricing.creditsPerUsd, pricing.mpFeePct)} cr
                </Badge>
              </CardContent>
              <CardFooter className="pt-2">
                <Button size="sm" className="w-full" onClick={() => onOpen(m)}>
                  <Wand2 className="h-3.5 w-3.5 mr-1.5" /> {t("catalog.use")}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      {filtered.length > 200 && (
        <p className="text-center text-xs text-muted-foreground py-4">{t("catalog.showingFirst")}</p>
      )}
    </>
  );
}

function ModelDialogContent({
  openModel,
  values,
  setValues,
  pricing,
  submitting,
  setOpenModel,
  handleGenerate,
  t,
}: {
  openModel: WSCatalogModel;
  values: Record<string, unknown>;
  setValues: (v: Record<string, unknown>) => void;
  pricing: { markup: number; creditsPerUsd: number; mpFeePct: number };
  submitting: boolean;
  setOpenModel: (m: WSCatalogModel | null) => void;
  handleGenerate: () => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const isMobile = useIsMobile();
  const [deferHeavyContent, setDeferHeavyContent] = useState(isMobile);

  useEffect(() => {
    if (!isMobile) {
      setDeferHeavyContent(false);
      return;
    }

    setDeferHeavyContent(true);
    const timer = window.setTimeout(() => setDeferHeavyContent(false), 250);
    return () => window.clearTimeout(timer);
  }, [isMobile, openModel.model_id]);

  const { translation, loading } = useModelTranslation(openModel, !deferHeavyContent);
  const { demo, loading: demoLoading } = useModelDemo(openModel.model_id, openModel.type, !deferHeavyContent);
  const desc = translation?.description || openModel.description;
  return (
    <>
      {/* Hero demo: solo si hay demo o está cargando */}
      {(demoLoading || demo) && (
        <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted/40 border-b border-border/50 shrink-0">
          {demoLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : demo!.kind === "video" ? (
            <video
              src={demo!.url}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <img
              src={demo!.url}
              alt={`${prettyName(openModel.model_id)} demo`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
          {demo && (
            <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] backdrop-blur bg-background/70">
              {t("catalog.demoLabel")}
            </Badge>
          )}
        </div>
      )}

      <DialogHeader className="p-6 pb-3 border-b border-border/50 shrink-0">
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {prettyName(openModel.model_id)}
          <Badge variant="outline" className="ml-1 text-xs">{getBrand(openModel.model_id)}</Badge>
        </DialogTitle>
        <DialogDescription className="text-xs">
          <span className="block">
            {desc}
            {loading && !translation && <Loader2 className="inline h-3 w-3 ml-1 animate-spin opacity-50" />}
          </span>
          <span className="block mt-1 font-mono text-[10px] opacity-60">{openModel.model_id}</span>
        </DialogDescription>
      </DialogHeader>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <DynamicSchemaForm
          schema={openModel.request_schema}
          values={values}
          onChange={setValues}
          fieldLabels={translation?.field_labels}
          fieldDescriptions={translation?.field_descriptions}
        />
      </div>
      <DialogFooter className="flex-row items-center justify-between gap-2 p-4 sm:p-6 pt-3 border-t border-border/50 shrink-0 sm:space-x-0">
        <Badge variant="outline" className="gap-1 border-primary/40 text-primary text-[10px] sm:text-xs shrink-0">
          <Coins className="h-3 w-3" />
          {computeModelCost(openModel.base_price, pricing.markup, pricing.creditsPerUsd, pricing.mpFeePct)} {t("common.credits")}
        </Badge>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpenModel(null)} disabled={submitting}>{t("catalog.cancel")}</Button>
          <Button size="sm" onClick={handleGenerate} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {t("catalog.generate")}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
