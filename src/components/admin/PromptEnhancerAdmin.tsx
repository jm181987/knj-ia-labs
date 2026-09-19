import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Coins, DollarSign, Loader2, RefreshCw, Save, Sparkles, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ModelRate = { input: number; output: number };

type PromptEnhancerConfig = {
  enabled: boolean;
  monthlyBudgetUsd: number;
  stopAtBudget: boolean;
  dailyUserLimit: number;
  chargeEnabled: boolean;
  chargeCredits: number;
  freeDaily: number;
  adminFree: boolean;
  primaryModel: string;
  fallbackModel: string;
  modelRates: Record<string, ModelRate>;
};

type Metrics = {
  summary: {
    totalSuccess: number;
    success24h: number;
    successMonth: number;
    costTotal: number;
    cost24h: number;
    costMonth: number;
    avgCostMonth: number;
    chargedCreditsMonth: number;
    failuresMonth: number;
    fallbackMonth: number;
    budgetPct: number;
  };
  models: Array<{
    model: string;
    uses: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  }>;
  users: Array<{
    userId: string;
    email: string;
    displayName: string;
    uses: number;
    costUsd: number;
    chargedCredits: number;
  }>;
};

function money(value: number, digits = 4) {
  if (!Number.isFinite(value)) return "$0";
  return `$${value.toFixed(value >= 1 ? 2 : digits)}`;
}

function emptyMetrics(): Metrics {
  return {
    summary: {
      totalSuccess: 0,
      success24h: 0,
      successMonth: 0,
      costTotal: 0,
      cost24h: 0,
      costMonth: 0,
      avgCostMonth: 0,
      chargedCreditsMonth: 0,
      failuresMonth: 0,
      fallbackMonth: 0,
      budgetPct: 0,
    },
    models: [],
    users: [],
  };
}

export function PromptEnhancerAdmin() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [config, setConfig] = useState<PromptEnhancerConfig | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("prompt-enhancer-admin", {
        body: { action: "get" },
      });
      if (error) throw error;
      if (!data || data.code !== 0) throw new Error(data?.message || t("admin.promptCosts.loadError"));
      setConfig(data.data.config);
      setMetrics(data.data.metrics || emptyMetrics());
    } catch (error) {
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("prompt-enhancer-admin", {
        body: { action: "save", config },
      });
      if (error) throw error;
      if (!data || data.code !== 0) throw new Error(data?.message || t("admin.promptCosts.saveError"));
      setConfig(data.data.config);
      setMetrics(data.data.metrics || emptyMetrics());
      toast({ title: t("admin.promptCosts.saved") });
    } catch (error) {
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const budgetState = useMemo(() => {
    const pct = metrics.summary.budgetPct;
    if (pct >= 100) return "critical";
    if (pct >= 80) return "warning";
    if (pct >= 50) return "watch";
    return "ok";
  }, [metrics.summary.budgetPct]);

  const setRate = (model: string, field: keyof ModelRate, value: number) => {
    if (!config || !model) return;
    setConfig({
      ...config,
      modelRates: {
        ...config.modelRates,
        [model]: {
          input: config.modelRates?.[model]?.input ?? 0,
          output: config.modelRates?.[model]?.output ?? 0,
          [field]: value,
        },
      },
    });
  };

  if (loading || !config) {
    return (
      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardContent className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const pct = Math.max(0, Math.min(100, metrics.summary.budgetPct));

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("admin.promptCosts.title")}
            </CardTitle>
            <CardDescription>{t("admin.promptCosts.description")}</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t("history.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={DollarSign} label={t("admin.promptCosts.cost24h")} value={money(metrics.summary.cost24h)} />
            <MetricCard icon={DollarSign} label={t("admin.promptCosts.costMonth")} value={money(metrics.summary.costMonth)} />
            <MetricCard icon={DollarSign} label={t("admin.promptCosts.costTotal")} value={money(metrics.summary.costTotal)} />
            <MetricCard icon={Sparkles} label={t("admin.promptCosts.improvementsMonth")} value={String(metrics.summary.successMonth)} />
            <MetricCard icon={DollarSign} label={t("admin.promptCosts.avgCost")} value={money(metrics.summary.avgCostMonth, 6)} />
            <MetricCard icon={Coins} label={t("admin.promptCosts.creditsCharged")} value={String(metrics.summary.chargedCreditsMonth)} />
            <MetricCard icon={Users} label={t("admin.promptCosts.last24h")} value={String(metrics.summary.success24h)} />
          </div>

          <div className="rounded-xl border border-border/70 bg-background/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{t("admin.promptCosts.monthlyBudget")}</p>
                <p className="text-xs text-muted-foreground">
                  {money(metrics.summary.costMonth)} / {money(config.monthlyBudgetUsd)}
                </p>
              </div>
              <Badge variant={budgetState === "critical" ? "destructive" : "outline"}>
                {metrics.summary.budgetPct.toFixed(1)}%
              </Badge>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            {budgetState !== "ok" && (
              <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>
                  {budgetState === "critical"
                    ? t("admin.promptCosts.budgetReached")
                    : budgetState === "warning"
                      ? t("admin.promptCosts.budget80")
                      : t("admin.promptCosts.budget50")}
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{t("admin.promptCosts.fallbacks")}</p>
              <p className="mt-1 text-xl font-bold">{metrics.summary.fallbackMonth}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{t("admin.promptCosts.errors")}</p>
              <p className="mt-1 text-xl font-bold">{metrics.summary.failuresMonth}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{t("admin.promptCosts.totalImprovements")}</p>
              <p className="mt-1 text-xl font-bold">{metrics.summary.totalSuccess}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>{t("admin.promptCosts.controls")}</CardTitle>
          <CardDescription>{t("admin.promptCosts.controlsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ToggleRow
            label={t("admin.promptCosts.enabled")}
            description={t("admin.promptCosts.enabledDesc")}
            checked={config.enabled}
            onChange={(enabled) => setConfig({ ...config, enabled })}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <NumberField
              label={t("admin.promptCosts.budgetUsd")}
              value={config.monthlyBudgetUsd}
              min={0}
              step={0.5}
              onChange={(monthlyBudgetUsd) => setConfig({ ...config, monthlyBudgetUsd })}
            />
            <NumberField
              label={t("admin.promptCosts.dailyLimit")}
              value={config.dailyUserLimit}
              min={0}
              step={1}
              onChange={(dailyUserLimit) => setConfig({ ...config, dailyUserLimit })}
            />
            <NumberField
              label={t("admin.promptCosts.freeDaily")}
              value={config.freeDaily}
              min={0}
              step={1}
              onChange={(freeDaily) => setConfig({ ...config, freeDaily })}
            />
            <NumberField
              label={t("admin.promptCosts.chargeCredits")}
              value={config.chargeCredits}
              min={0}
              step={1}
              disabled={!config.chargeEnabled}
              onChange={(chargeCredits) => setConfig({ ...config, chargeCredits })}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <ToggleRow
              label={t("admin.promptCosts.stopAtBudget")}
              description={t("admin.promptCosts.stopAtBudgetDesc")}
              checked={config.stopAtBudget}
              onChange={(stopAtBudget) => setConfig({ ...config, stopAtBudget })}
            />
            <ToggleRow
              label={t("admin.promptCosts.chargeEnabled")}
              description={t("admin.promptCosts.chargeEnabledDesc")}
              checked={config.chargeEnabled}
              onChange={(chargeEnabled) => setConfig({ ...config, chargeEnabled })}
            />
            <ToggleRow
              label={t("admin.promptCosts.adminFree")}
              description={t("admin.promptCosts.adminFreeDesc")}
              checked={config.adminFree}
              onChange={(adminFree) => setConfig({ ...config, adminFree })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("admin.promptCosts.primaryModel")}</Label>
              <Input value={config.primaryModel} onChange={(e) => setConfig({ ...config, primaryModel: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.promptCosts.fallbackModel")}</Label>
              <Input value={config.fallbackModel} onChange={(e) => setConfig({ ...config, fallbackModel: e.target.value })} />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 p-4">
            <p className="text-sm font-semibold">{t("admin.promptCosts.tokenRates")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("admin.promptCosts.tokenRatesDesc")}</p>
            {[config.primaryModel, config.fallbackModel].filter(Boolean).filter((m, i, a) => a.indexOf(m) === i).map((model) => (
              <div key={model} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px] md:items-end">
                <div className="min-w-0">
                  <Label className="text-xs">{model}</Label>
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{model}</p>
                </div>
                <NumberField
                  label={t("admin.promptCosts.inputRate")}
                  value={config.modelRates?.[model]?.input ?? 0}
                  min={0}
                  step={0.01}
                  onChange={(value) => setRate(model, "input", value)}
                />
                <NumberField
                  label={t("admin.promptCosts.outputRate")}
                  value={config.modelRates?.[model]?.output ?? 0}
                  min={0}
                  step={0.01}
                  onChange={(value) => setRate(model, "output", value)}
                />
              </div>
            ))}
          </div>

          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t("common.save")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>{t("admin.promptCosts.byModel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("history.model")}</TableHead>
                  <TableHead className="text-right">{t("admin.promptCosts.uses")}</TableHead>
                  <TableHead className="text-right">{t("admin.promptCosts.inputTokens")}</TableHead>
                  <TableHead className="text-right">{t("admin.promptCosts.outputTokens")}</TableHead>
                  <TableHead className="text-right">{t("admin.promptCosts.cost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.models.map((row) => (
                  <TableRow key={row.model}>
                    <TableCell className="font-mono text-xs">{row.model}</TableCell>
                    <TableCell className="text-right">{row.uses}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{row.inputTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{row.outputTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{money(row.costUsd)}</TableCell>
                  </TableRow>
                ))}
                {metrics.models.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{t("admin.promptCosts.noUsage")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>{t("admin.promptCosts.topUsers")}</CardTitle>
          <CardDescription>{t("admin.promptCosts.topUsersDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.user")}</TableHead>
                  <TableHead className="text-right">{t("admin.promptCosts.uses")}</TableHead>
                  <TableHead className="text-right">{t("admin.promptCosts.cost")}</TableHead>
                  <TableHead className="text-right">{t("admin.promptCosts.creditsCharged")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.users.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <div className="font-medium">{row.displayName || row.email || row.userId.slice(0, 8)}</div>
                      {row.displayName && row.email && <div className="text-xs text-muted-foreground">{row.email}</div>}
                    </TableCell>
                    <TableCell className="text-right">{row.uses}</TableCell>
                    <TableCell className="text-right font-mono">{money(row.costUsd)}</TableCell>
                    <TableCell className="text-right font-mono">{row.chargedCredits}</TableCell>
                  </TableRow>
                ))}
                {metrics.users.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t("admin.promptCosts.noUsage")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof DollarSign; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
      <div>
        <Label>{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
