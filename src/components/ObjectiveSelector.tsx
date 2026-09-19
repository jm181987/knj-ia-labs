import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AudioLines,
  Image as ImageIcon,
  ImagePlus,
  MessageCircleMore,
  ScanSearch,
  Sparkles,
  UserRound,
  Video,
  WandSparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  OBJECTIVES,
  getModelRequirements,
  objectiveModels,
  type ObjectiveId,
} from "@/lib/catalogExperience";
import { computeModelCost, getBrand, prettyName, type PricingSettings, type WSCatalogModel } from "@/lib/wavespeedCatalog";
import { cn } from "@/lib/utils";

type ObjectiveSelectorProps = {
  models: WSCatalogModel[];
  pricing: PricingSettings;
  onOpen: (model: WSCatalogModel) => void;
};

const OBJECTIVE_ICONS: Record<ObjectiveId, typeof Sparkles> = {
  imageToVideo: Video,
  textToVideo: WandSparkles,
  createImage: ImagePlus,
  editImage: ImageIcon,
  talkingAvatar: UserRound,
  upscale: ScanSearch,
  removeObjects: Sparkles,
  createVoice: AudioLines,
};

export function ObjectiveSelector({ models, pricing, onOpen }: ObjectiveSelectorProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ObjectiveId>("imageToVideo");
  const recommendations = useMemo(() => objectiveModels(models, selected, 4), [models, selected]);

  return (
    <section className="rounded-2xl border border-border/70 bg-card/35 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageCircleMore className="h-4.5 w-4.5" />
        </div>
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">{t("catalog.objectives.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("catalog.objectives.subtitle")}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OBJECTIVES.map((objective) => {
          const Icon = OBJECTIVE_ICONS[objective.id];
          const active = selected === objective.id;
          return (
            <button
              key={objective.id}
              type="button"
              onClick={() => setSelected(objective.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                active
                  ? "border-primary/50 bg-primary/10 shadow-sm"
                  : "border-border/70 bg-background/45 hover:border-primary/30 hover:bg-background/70",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
              <p className="mt-2 text-sm font-semibold leading-tight">{t(objective.labelKey)}</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                {t(objective.descriptionKey)}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("catalog.objectives.recommended")}
          </p>
          <Badge variant="secondary" className="text-[10px]">{recommendations.length}</Badge>
        </div>

        {recommendations.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {recommendations.map((model) => {
              const requirements = getModelRequirements(model);
              return (
                <div key={model.model_id} className="flex flex-col rounded-xl border border-border/70 bg-background/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{model.name || prettyName(model.model_id)}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{getBrand(model.model_id)}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-primary">
                      {t("catalog.objectives.from")} {computeModelCost(model.base_price, pricing.markup, pricing.creditsPerUsd, pricing.mpFeePct)} cr
                    </span>
                  </div>

                  <div className="mt-3 flex min-h-6 flex-wrap gap-1">
                    {requirements.map((req) => (
                      <Badge key={req} variant="outline" className="text-[9px]">
                        {t(`catalog.requirements.${req}`)}
                      </Badge>
                    ))}
                  </div>

                  <Button size="sm" className="mt-3 w-full" onClick={() => onOpen(model)}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    {t("catalog.use")}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">
            {t("catalog.objectives.empty")}
          </div>
        )}
      </div>
    </section>
  );
}
