import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock3, Heart, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBrand, prettyName, type WSCatalogModel } from "@/lib/wavespeedCatalog";

type QuickAccessProps = {
  models: WSCatalogModel[];
  favoriteIds: string[];
  recentIds: string[];
  onOpen: (model: WSCatalogModel) => void;
  onToggleFavorite: (modelId: string) => void;
};

function orderedModels(models: WSCatalogModel[], ids: string[]) {
  const map = new Map(models.map((model) => [model.model_id, model]));
  return ids.map((id) => map.get(id)).filter((model): model is WSCatalogModel => Boolean(model));
}

function MiniList({
  title,
  icon: Icon,
  models,
  empty,
  favoriteIds,
  onOpen,
  onToggleFavorite,
}: {
  title: string;
  icon: typeof Heart;
  models: WSCatalogModel[];
  empty: string;
  favoriteIds: string[];
  onOpen: (model: WSCatalogModel) => void;
  onToggleFavorite: (modelId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/45 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
        {models.length > 0 && <Badge variant="secondary" className="ml-auto text-[10px]">{models.length}</Badge>}
      </div>
      {models.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {models.slice(0, 4).map((model) => {
            const favorite = favoriteIds.includes(model.model_id);
            return (
              <div key={model.model_id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 p-2">
                <button
                  type="button"
                  onClick={() => onToggleFavorite(model.model_id)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-primary"
                  aria-label={favorite ? "remove favorite" : "add favorite"}
                >
                  <Heart className={favorite ? "h-3.5 w-3.5 fill-current text-primary" : "h-3.5 w-3.5"} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{model.name || prettyName(model.model_id)}</p>
                  <p className="truncate text-[9px] uppercase tracking-wider text-muted-foreground">{getBrand(model.model_id)}</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0" onClick={() => onOpen(model)}>
                  <Wand2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CatalogQuickAccess({
  models,
  favoriteIds,
  recentIds,
  onOpen,
  onToggleFavorite,
}: QuickAccessProps) {
  const { t } = useTranslation();
  const favorites = useMemo(() => orderedModels(models, favoriteIds), [models, favoriteIds]);
  const recents = useMemo(() => orderedModels(models, recentIds), [models, recentIds]);

  if (favorites.length === 0 && recents.length === 0) return null;

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <MiniList
        title={t("catalog.quickAccess.favorites")}
        icon={Heart}
        models={favorites}
        empty={t("catalog.quickAccess.noFavorites")}
        favoriteIds={favoriteIds}
        onOpen={onOpen}
        onToggleFavorite={onToggleFavorite}
      />
      <MiniList
        title={t("catalog.quickAccess.recents")}
        icon={Clock3}
        models={recents}
        empty={t("catalog.quickAccess.noRecents")}
        favoriteIds={favoriteIds}
        onOpen={onOpen}
        onToggleFavorite={onToggleFavorite}
      />
    </section>
  );
}
