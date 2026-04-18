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

export default function CatalogPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [models, setModels] = useState<WSCatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pricing, setPricing] = useState<{ markup: number; creditsPerUsd: number }>({ markup: 3, creditsPerUsd: 37 });
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
        toast({ title: `Falta el campo "${r}"`, variant: "destructive" });
        return;
      }
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await submitDynamic({ model: openModel, values, userId: user?.id });
      if (res.code !== 0 || !res.data) throw new Error(res.message || "Error al enviar");
      toast({ title: "Generación en cola", description: "Te avisamos cuando esté lista" });
      setOpenModel(null);
      navigate("/app/history");
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
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
          placeholder="Buscar por nombre, marca o descripción…"
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
        <>
          <p className="text-sm text-muted-foreground">{filtered.length} modelos</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.slice(0, 200).map((m) => (
              <Card key={m.model_id} className="hover:border-primary/50 transition-colors flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{prettyName(m.model_id)}</CardTitle>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{getBrand(m.model_id)}</Badge>
                  </div>
                  <CardDescription className="text-xs line-clamp-3">{m.description || "Sin descripción"}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 pb-2 flex-1">
                  <Badge variant="secondary" className="text-[10px]">{m.type}</Badge>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button size="sm" className="w-full" onClick={() => onOpen(m)}>
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Usar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          {filtered.length > 200 && (
            <p className="text-center text-xs text-muted-foreground py-4">
              Mostrando los primeros 200 — refiná tu búsqueda para ver más.
            </p>
          )}
        </>
      )}

      {/* Modal de generación */}
      <Dialog open={!!openModel} onOpenChange={(o) => !o && setOpenModel(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          {openModel && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {prettyName(openModel.model_id)}
                  <Badge variant="outline" className="ml-1 text-xs">{getBrand(openModel.model_id)}</Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  <span className="block">{openModel.description}</span>
                  <span className="block mt-1 font-mono text-[10px] opacity-60">{openModel.model_id}</span>
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-3 -mr-3">
                <DynamicSchemaForm schema={openModel.request_schema} values={values} onChange={setValues} />
              </ScrollArea>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenModel(null)} disabled={submitting}>Cancelar</Button>
                <Button onClick={handleGenerate} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Generar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
