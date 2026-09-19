import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AudioLines,
  Clapperboard,
  Coins,
  Image as ImageIcon,
  Heart,
  PencilRuler,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  computeModelCost,
  getBrand,
  type PricingSettings,
  type WSCatalogModel,
} from "@/lib/wavespeedCatalog";
import {
  resolveFeaturedModels,
  type FeaturedGroup,
  type FeaturedModelConfigItem,
} from "@/lib/featuredModels";
import { cn } from "@/lib/utils";

type FeaturedModelsProps = {
  models: WSCatalogModel[];
  pricing: PricingSettings;
  onOpen: (model: WSCatalogModel) => void;
  favoriteIds?: string[];
  onToggleFavorite?: (modelId: string) => void;
  customConfig?: FeaturedModelConfigItem[] | null;
};

const GROUPS: Array<{ id: FeaturedGroup; icon: typeof Sparkles }> = [
  { id: "all", icon: Sparkles },
  { id: "video", icon: Clapperboard },
  { id: "image", icon: ImageIcon },
  { id: "edit", icon: PencilRuler },
  { id: "avatar", icon: UserRound },
  { id: "audio", icon: AudioLines },
];

export function FeaturedModels({
  models,
  pricing,
  onOpen,
  favoriteIds = [],
  onToggleFavorite,
  customConfig = null,
}: FeaturedModelsProps) {
  const { t } = useTranslation();
  const [group, setGroup] = useState<FeaturedGroup>("all");
  const resolved = useMemo(() => resolveFeaturedModels(models, customConfig), [models, customConfig]);

  const visible = useMemo(
    () => resolved.filter(({ spec }) => group === "all" || spec.group === group),
    [group, resolved],
  );

  if (resolved.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card/55 p-4 sm:p-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 15% 0%, hsl(var(--primary) / 0.15), transparent 35%), radial-gradient(circle at 90% 100%, hsl(var(--primary-glow) / 0.10), transparent 35%)",
        }}
      />

      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t("catalog.featuredViewer.eyebrow")}
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("catalog.featuredViewer.title")}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t("catalog.featuredViewer.subtitle")}
            </p>
          </div>

          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
            {GROUPS.map(({ id, icon: Icon }) => {
              const active = group === id;
              return (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => setGroup(id)}
                  className="h-8 shrink-0 rounded-full px-3 text-xs"
                >
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {t(`catalog.featuredViewer.groups.${id}`)}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {visible.map(({ spec, model }) => {
            const favorite = favoriteIds.includes(model.model_id);
            const cost = computeModelCost(
              model.base_price,
              pricing.markup,
              pricing.creditsPerUsd,
              pricing.mpFeePct,
            );

            return (
              <article
                key={spec.id}
                className={cn(
                  "group relative flex min-h-[220px] min-w-[82%] snap-start flex-col rounded-xl border border-border/70 bg-background/70 p-4 transition-all",
                  "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-elegant sm:min-w-[310px] lg:min-w-[285px]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {getBrand(model.model_id)}
                    </p>
                    <h3 className="mt-1 truncate text-lg font-bold">
                      {spec.title || model.name}
                    </h3>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <Badge className="gap-1 text-[10px]">
                      <Sparkles className="h-2.5 w-2.5" />
                      {spec.badge || (spec.badgeKey ? t(spec.badgeKey) : t("catalog.featured"))}
                    </Badge>
                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(model.model_id)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                        title={favorite ? t("catalog.quickAccess.removeFavorite") : t("catalog.quickAccess.addFavorite")}
                        aria-label={favorite ? t("catalog.quickAccess.removeFavorite") : t("catalog.quickAccess.addFavorite")}
                      >
                        <Heart className={favorite ? "h-3.5 w-3.5 fill-current text-primary" : "h-3.5 w-3.5"} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {spec.strength || (spec.strengthKey ? t(spec.strengthKey) : model.description || t("catalog.noDescription"))}
                </p>

                <div className="mt-auto pt-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {t(`catalog.featuredViewer.groups.${spec.group}`)}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <Coins className="h-3.5 w-3.5" />
                      {cost} {t("common.credits")}
                    </span>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    onClick={() => onOpen(model)}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    {t("catalog.featuredViewer.useModel")}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        {visible.length === 0 && (
          <div className="mt-5 rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            {t("catalog.featuredViewer.empty")}
          </div>
        )}
      </div>
    </section>
  );
}
