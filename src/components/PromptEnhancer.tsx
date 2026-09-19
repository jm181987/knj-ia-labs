import { useCallback, useEffect, useState } from "react";
import { Coins, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { WSCatalogModel } from "@/lib/wavespeedCatalog";
import { useToast } from "@/hooks/use-toast";

type PromptEnhancerProps = {
  model: WSCatalogModel;
  prompt: string;
  onApply: (prompt: string) => void;
};

type Quote = {
  enabled: boolean;
  chargedCredits: number;
  freeRemaining: number;
  dailyRemaining: number | null;
  budgetReached: boolean;
  dailyLimitReached: boolean;
};

export function PromptEnhancer({ model, prompt, onApply }: PromptEnhancerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);

  const loadQuote = useCallback(async () => {
    setQuoteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("improve-prompt", {
        body: { action: "quote" },
      });
      if (error) throw error;
      setQuote(data?.data || null);
    } catch {
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  useEffect(() => { loadQuote(); }, [loadQuote]);

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
      toast({
        title: t("catalog.promptEnhancer.done"),
        description: Number(data.data.chargedCredits || 0) > 0
          ? t("catalog.promptEnhancer.charged", { count: data.data.chargedCredits })
          : t("catalog.promptEnhancer.free"),
      });
      await loadQuote();
    } catch (error) {
      await loadQuote();
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

  const unavailableReason = quote?.budgetReached
    ? t("catalog.promptEnhancer.budgetUnavailable")
    : quote?.dailyLimitReached
      ? t("catalog.promptEnhancer.dailyUnavailable")
      : t("catalog.promptEnhancer.unavailable");

  const priceLabel = quote?.chargedCredits && quote.chargedCredits > 0
    ? t("catalog.promptEnhancer.creditPrice", { count: quote.chargedCredits })
    : t("catalog.promptEnhancer.free");

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-foreground">{t("catalog.promptEnhancer.title")}</p>
          {!quoteLoading && quote && quote.enabled && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              {quote.chargedCredits > 0 && <Coins className="h-2.5 w-2.5" />}
              {priceLabel}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {!quoteLoading && quote && !quote.enabled ? unavailableReason : t("catalog.promptEnhancer.subtitle")}
        </p>
        {!quoteLoading && quote && quote.enabled && quote.freeRemaining > 0 && (
          <p className="mt-0.5 text-[10px] text-primary">
            {t("catalog.promptEnhancer.freeRemaining", { count: quote.freeRemaining })}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {previous !== null && (
          <Button type="button" size="sm" variant="ghost" onClick={undo} disabled={loading}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t("catalog.promptEnhancer.undo")}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={improve}
          disabled={loading || quoteLoading || quote?.enabled === false || prompt.trim().length < 3}
        >
          {loading || quoteLoading
            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          {loading
            ? t("catalog.promptEnhancer.improving")
            : quoteLoading
              ? t("catalog.promptEnhancer.checking")
              : `${t("catalog.promptEnhancer.action")} · ${priceLabel}`}
        </Button>
      </div>
    </div>
  );
}
