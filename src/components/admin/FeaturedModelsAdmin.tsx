import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Save, Search, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { fetchCatalog, getBrand, prettyName, type WSCatalogModel } from "@/lib/wavespeedCatalog";
import {
  fetchFeaturedModelConfig,
  resetFeaturedModelConfig,
  saveFeaturedModelConfig,
  type FeaturedModelConfigItem,
  type FeaturedGroup,
} from "@/lib/featuredModels";

const GROUPS: Exclude<FeaturedGroup, "all">[] = ["video", "image", "edit", "avatar", "audio"];

function newRow(model: WSCatalogModel): FeaturedModelConfigItem {
  const type = model.type;
  const group: Exclude<FeaturedGroup, "all"> =
    type.includes("video") ? (type === "video-to-video" ? "edit" : "video")
      : type.includes("audio") ? "audio"
      : type === "digital-human" || type === "portrait-transfer" ? "avatar"
      : type === "image-to-image" || type === "image-effects" ? "edit"
      : "image";
  return {
    id: model.model_id,
    model_id: model.model_id,
    group,
    title: model.name || prettyName(model.model_id),
    badge: "Destacado",
    strength: model.description || "",
    enabled: true,
  };
}

export function FeaturedModelsAdmin() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<WSCatalogModel[]>([]);
  const [rows, setRows] = useState<FeaturedModelConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [models, config] = await Promise.all([fetchCatalog(), fetchFeaturedModelConfig()]);
      setCatalog(models);
      setRows(config || []);
    } catch (error) {
      toast({ title: t("common.error"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const selected = new Set(rows.map((row) => row.model_id));
    return catalog
      .filter((model) => !selected.has(model.model_id))
      .filter((model) =>
        [model.model_id, model.name, model.type, getBrand(model.model_id)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [catalog, rows, search]);

  const update = (index: number, patch: Partial<FeaturedModelConfigItem>) => {
    setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));
  };

  const move = (index: number, direction: -1 | 1) => {
    setRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveFeaturedModelConfig(rows);
      toast({ title: t("admin.featured.saved") });
    } catch (error) {
      toast({ title: t("common.error"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm(t("admin.featured.resetConfirm"))) return;
    setSaving(true);
    try {
      await resetFeaturedModelConfig();
      setRows([]);
      toast({ title: t("admin.featured.resetDone") });
    } catch (error) {
      toast({ title: t("common.error"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-primary" /> {t("admin.featured.title")}</CardTitle>
            <CardDescription>{t("admin.featured.description")}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={reset} disabled={saving}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {t("admin.featured.restore")}
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              {t("common.save")}
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.featured.search")} className="pl-9" />
        </div>
        {available.length > 0 && (
          <div className="grid gap-2 rounded-lg border border-border/60 bg-background/50 p-2 sm:grid-cols-2">
            {available.map((model) => (
              <button
                key={model.model_id}
                type="button"
                onClick={() => { setRows((current) => [...current, newRow(model)]); setSearch(""); }}
                className="flex items-center gap-3 rounded-md border border-transparent p-2 text-left hover:border-primary/30 hover:bg-primary/5"
              >
                <Plus className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{model.name || prettyName(model.model_id)}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{getBrand(model.model_id)} · {model.type}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            {t("admin.featured.defaultsActive")}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id || row.model_id} className="rounded-xl border border-border/70 bg-background/45 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{row.title || prettyName(row.model_id)}</p>
                      <Badge variant="outline" className="text-[10px]">{row.group}</Badge>
                      {!row.enabled && <Badge variant="secondary" className="text-[10px]">{t("admin.inactive")}</Badge>}
                    </div>
                    <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{row.model_id}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(index, 1)} disabled={index === rows.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("admin.featured.visibleName")}</Label>
                    <Input value={row.title || ""} onChange={(event) => update(index, { title: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.featured.group")}</Label>
                    <Select value={row.group} onValueChange={(value) => update(index, { group: value as Exclude<FeaturedGroup, "all"> })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GROUPS.map((group) => <SelectItem key={group} value={group}>{t(`catalog.featuredViewer.groups.${group}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("admin.featured.badge")}</Label>
                    <Input value={row.badge || ""} onChange={(event) => update(index, { badge: event.target.value })} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <Label>{t("admin.featured.enabled")}</Label>
                    <Switch checked={row.enabled !== false} onCheckedChange={(enabled) => update(index, { enabled })} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>{t("admin.featured.strength")}</Label>
                    <Input value={row.strength || ""} onChange={(event) => update(index, { strength: event.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
