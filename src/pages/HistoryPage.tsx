import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import {
  listGenerations,
  listGenerationCreditSummaries,
  checkVideoStatus,
  checkImageStatus,
  type Generation,
  type GenerationCreditSummary,
} from "@/lib/wavespeed";
import {
  Check,
  Coins,
  Copy,
  Download,
  Image,
  Loader2,
  RefreshCw,
  RotateCcw,
  Video,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

function cleanGenerationValues(gen: Generation) {
  const params = { ...(gen.parameters || {}) } as Record<string, unknown>;
  delete params.modelPath;
  delete params.basePrice;
  delete params.costCredits;
  delete params.user_id;
  if (!params.prompt) params.prompt = gen.prompt;
  return params;
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [creditMap, setCreditMap] = useState<Record<string, GenerationCreditSummary>>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchGenerations = useCallback(async () => {
    try {
      const data = await listGenerations({
        type: typeFilter !== "all" ? typeFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setGenerations(data);
      const summaries = await listGenerationCreditSummaries(data.map((item) => item.id));
      setCreditMap(summaries);
    } catch (e) {
      console.error("Failed to fetch generations:", e);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  useEffect(() => {
    const processing = generations.filter((g) => g.status === "processing");
    if (processing.length === 0) return;

    const interval = setInterval(async () => {
      for (const gen of processing) {
        if (!gen.task_id) continue;
        if (gen.type === "video") {
          await checkVideoStatus(gen.task_id);
        } else {
          await checkImageStatus(gen.task_id);
        }
      }
      fetchGenerations();
    }, 10000);

    return () => clearInterval(interval);
  }, [generations, fetchGenerations]);

  const repeatGeneration = (gen: Generation) => {
    const modelPath = String(gen.parameters?.modelPath || "");
    navigate("/app/catalog", {
      state: {
        generationPreset: {
          modelPath,
          values: cleanGenerationValues(gen),
        },
      },
    });
  };

  const chooseAnotherModel = (gen: Generation) => {
    try {
      sessionStorage.setItem("knj.catalog.promptDraft", gen.prompt || "");
    } catch {
      // Storage can be disabled; catalog will still open normally.
    }
    navigate("/app/catalog");
  };

  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast({ title: t("history.promptCopied") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("history.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t("history.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => { setLoading(true); fetchGenerations(); }}>
          <RefreshCw className="h-4 w-4 mr-1" /> {t("history.refresh")}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder={t("history.filterType")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="video">{t("history.video")}</SelectItem>
            <SelectItem value="image">{t("history.image")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder={t("history.filterStatus")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="pending">{t("history.statusPending")}</SelectItem>
            <SelectItem value="processing">{t("history.statusProcessing")}</SelectItem>
            <SelectItem value="completed">{t("history.statusCompleted")}</SelectItem>
            <SelectItem value="failed">{t("history.statusFailed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : generations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">{t("history.empty")}</p>
          <p className="text-sm mt-1">{t("history.emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {generations.map((gen) => {
            const credits = creditMap[gen.id];
            const originalCost = credits?.debited || Number(gen.parameters?.costCredits || 0);
            const refunded = credits?.refunded || 0;
            const hasModelPath = Boolean(gen.parameters?.modelPath);

            return (
              <Card key={gen.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-accent">
                      {gen.type === "video" ? (
                        <Video className="h-5 w-5 text-accent-foreground" />
                      ) : (
                        <Image className="h-5 w-5 text-accent-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <StatusBadge status={gen.status} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(gen.created_at).toLocaleString()}
                        </span>
                        {originalCost > 0 && (
                          <Badge variant="outline" className="gap-1 text-[10px] border-primary/30 text-primary">
                            <Coins className="h-2.5 w-2.5" />
                            {originalCost} {t("history.creditsUsed")}
                          </Badge>
                        )}
                        {refunded > 0 && (
                          <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            <Check className="h-2.5 w-2.5" />
                            {refunded} {t("history.creditsRefunded")}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm leading-relaxed break-words">{gen.prompt}</p>

                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                        {gen.model && <span>{t("history.model")}: {gen.model}</span>}
                        {gen.aspect_ratio && <span>• {gen.aspect_ratio}</span>}
                        {gen.type === "video" && gen.duration && <span>• {gen.duration}s</span>}
                      </div>

                      {gen.status === "completed" && gen.result_urls.length > 0 && (
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {gen.result_urls.map((url, i) => (
                            <div key={i} className="relative overflow-hidden rounded-md border border-border/60 bg-muted">
                              {gen.type === "video" ? (
                                <video src={url} controls className="h-28 max-w-full rounded-md" />
                              ) : (
                                <img src={url} alt="" className="h-28 max-w-full rounded-md object-cover" />
                              )}
                              <a
                                href={url}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute right-1 top-1"
                              >
                                <Button size="icon" variant="secondary" className="h-7 w-7">
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                            </div>
                          ))}
                        </div>
                      )}

                      {gen.status === "failed" && gen.error_message && (
                        <p className="text-xs text-destructive mt-2">{gen.error_message}</p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                        <Button size="sm" variant="outline" onClick={() => copyPrompt(gen.prompt)}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          {t("history.copyPrompt")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => chooseAnotherModel(gen)}>
                          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                          {t("history.useAnotherModel")}
                        </Button>
                        {hasModelPath && (
                          <Button size="sm" onClick={() => repeatGeneration(gen)}>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            {gen.status === "failed" ? t("history.retry") : t("history.repeat")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
