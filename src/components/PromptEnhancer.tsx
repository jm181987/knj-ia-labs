import { useState } from "react";
import { Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { WSCatalogModel } from "@/lib/wavespeedCatalog";
import { useToast } from "@/hooks/use-toast";

type PromptEnhancerProps = {
  model: WSCatalogModel;
  prompt: string;
  onApply: (prompt: string) => void;
};

export function PromptEnhancer({ model, prompt, onApply }: PromptEnhancerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);

  const improve = async () => {
    const clean = prompt.trim();
    if (clean.length < 3) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("improve-prompt", {
        body: {
          prompt: clean,
          model_id: model.model_id,
          model_name: model.name,
          model_type: model.type,
        },
      });
      if (error) throw error;
      if (!data || data.code !== 0 || !data.data?.prompt) {
        throw new Error(data?.message || t("catalog.promptEnhancer.error"));
      }
      setPrevious(prompt);
      onApply(String(data.data.prompt));
      toast({ title: t("catalog.promptEnhancer.done") });
    } catch (error) {
      toast({
        title: t("catalog.promptEnhancer.error"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const undo = () => {
    if (previous == null) return;
    onApply(previous);
    setPrevious(null);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
      <div>
        <p className="text-xs font-semibold text-foreground">{t("catalog.promptEnhancer.title")}</p>
        <p className="text-[11px] text-muted-foreground">{t("catalog.promptEnhancer.subtitle")}</p>
      </div>
      <div className="flex gap-2">
        {previous !== null && (
          <Button type="button" size="sm" variant="ghost" onClick={undo} disabled={loading}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t("catalog.promptEnhancer.undo")}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={improve} disabled={loading || prompt.trim().length < 3}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          {loading ? t("catalog.promptEnhancer.improving") : t("catalog.promptEnhancer.action")}
        </Button>
      </div>
    </div>
  );
}
