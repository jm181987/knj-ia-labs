import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, TrendingUp, Wallet, Users, MousePointerClick, DollarSign, Award, Info } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";

type Stats = { clicks: number; referrals: number; conversions: number; gross_sales_uyu: number; pending_balance: number; approved_balance: number; total_paid: number; total_earned: number };

export default function AffiliateDashboard() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [code, setCode] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("affiliate-self", { body: { action: "me" } });
    setData(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const register = async () => {
    const { data, error } = await supabase.functions.invoke("affiliate-self", { body: { action: "register", code } });
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: t("affiliate.dashboard.request_sent_title"), description: t("affiliate.dashboard.request_sent_desc") });
    load();
  };

  const requestPayout = async () => {
    const { data, error } = await supabase.functions.invoke("affiliate-self", { body: { action: "request_payout" } });
    if (error || (data as any)?.error) {
      const raw = (data as any)?.error || error?.message || "";
      const msg =
        /below_minimum/i.test(raw) ? t("affiliate.dashboard.err_below_minimum") :
        /not_approved/i.test(raw) ? t("affiliate.dashboard.err_not_approved") :
        /not authenticated/i.test(raw) ? t("affiliate.dashboard.err_not_authenticated") :
        raw || t("affiliate.dashboard.err_retry");
      toast({ title: t("affiliate.dashboard.payout_error_title"), description: msg, variant: "destructive" });
      return;
    }
    toast({ title: t("affiliate.dashboard.payout_requested") });
    load();
  };

  if (loading) return <div className="grid place-items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const aff = data?.affiliate;
  if (!aff) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="bg-card/60 border-border/60">
          <CardHeader><CardTitle>{t("affiliate.dashboard.join_title")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("affiliate.dashboard.join_desc")}</p>
            <Input placeholder={t("affiliate.dashboard.code_placeholder")} value={code} onChange={e => setCode(e.target.value)} maxLength={32} />
            <Button onClick={register} disabled={code.length < 3}>{t("affiliate.dashboard.request")}</Button>
          </CardContent>
        </Card>
        <HowItWorks className="mt-6" />
      </div>
    );
  }

  const stats: Stats = data.stats;
  const link = `${window.location.origin}/?ref=${aff.code}`;

  const StatCard = ({ icon: Icon, label, value, hint }: any) => (
    <Card className="bg-card/60 border-border/60">
      <CardContent className="p-5 space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("affiliate.dashboard.panel_title")}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={aff.status === "approved" ? "default" : "secondary"}>{aff.status}</Badge>
            <Badge variant="outline" className="capitalize"><Award className="h-3 w-3 mr-1" /> {aff.tier}</Badge>
          </div>
        </div>
        <Button onClick={requestPayout} disabled={aff.status !== "approved"}>
          <Wallet className="h-4 w-4 mr-2" /> {t("affiliate.dashboard.request_payout")}
        </Button>
      </div>

      <Card className="bg-gradient-to-br from-primary/15 to-transparent border-primary/30">
        <CardContent className="p-6 space-y-3">
          <div className="text-sm text-muted-foreground">{t("affiliate.dashboard.your_link")}</div>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={link} className="flex-1 min-w-[260px] bg-background" />
            <Button onClick={() => { navigator.clipboard.writeText(link); toast({ title: t("affiliate.dashboard.copied") }); }}>
              <Copy className="h-4 w-4 mr-2" /> {t("affiliate.dashboard.copy")}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">{t("affiliate.dashboard.code_label")}: <span className="font-mono">{aff.code}</span></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={MousePointerClick} label={t("affiliate.dashboard.stat_clicks")} value={stats.clicks} />
        <StatCard icon={Users} label={t("affiliate.dashboard.stat_referrals")} value={stats.referrals} />
        <StatCard icon={TrendingUp} label={t("affiliate.dashboard.stat_conversions")} value={stats.conversions} />
        <StatCard icon={DollarSign} label={t("affiliate.dashboard.stat_sales")} value={`$${Math.round(stats.gross_sales_uyu)}`} hint="UYU" />
        <StatCard icon={Wallet} label={t("affiliate.dashboard.stat_pending")} value={`$${stats.pending_balance.toFixed(0)}`} hint={t("affiliate.dashboard.stat_pending_hint")} />
        <StatCard icon={Wallet} label={t("affiliate.dashboard.stat_approved")} value={`$${stats.approved_balance.toFixed(0)}`} hint={t("affiliate.dashboard.stat_approved_hint")} />
        <StatCard icon={Wallet} label={t("affiliate.dashboard.stat_paid")} value={`$${stats.total_paid.toFixed(0)}`} />
        <StatCard icon={TrendingUp} label={t("affiliate.dashboard.stat_earned")} value={`$${stats.total_earned.toFixed(0)}`} />
      </div>

      <HowItWorks />

      <Card className="bg-card/60 border-border/60">
        <CardHeader><CardTitle>{t("affiliate.dashboard.recent_commissions")}</CardTitle></CardHeader>
        <CardContent>
          {(data.commissions || []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">{t("affiliate.dashboard.no_commissions")}</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>{t("affiliate.dashboard.col_date")}</TableHead><TableHead>{t("affiliate.dashboard.col_plan")}</TableHead><TableHead>{t("affiliate.dashboard.col_type")}</TableHead><TableHead>{t("affiliate.dashboard.col_gross")}</TableHead><TableHead>{t("affiliate.dashboard.col_rate")}</TableHead><TableHead>{t("affiliate.dashboard.col_commission")}</TableHead><TableHead>{t("affiliate.dashboard.col_status")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.commissions.slice(0, 20).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{c.plan}</TableCell>
                    <TableCell>{c.type === "recurring" ? t("affiliate.dashboard.type_recurring") : t("affiliate.dashboard.type_one_time")}</TableCell>
                    <TableCell>${Number(c.gross_amount_uyu).toFixed(0)}</TableCell>
                    <TableCell>{(Number(c.rate) * 100).toFixed(0)}%</TableCell>
                    <TableCell className="font-semibold text-primary">${Number(c.commission_uyu).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/60 border-border/60">
        <CardHeader><CardTitle>{t("affiliate.dashboard.payout_history")}</CardTitle></CardHeader>
        <CardContent>
          {(data.payouts || []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">{t("affiliate.dashboard.no_payouts")}</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>{t("affiliate.dashboard.col_date")}</TableHead><TableHead>{t("affiliate.dashboard.col_amount")}</TableHead><TableHead>{t("affiliate.dashboard.col_status")}</TableHead><TableHead>{t("affiliate.dashboard.col_ref")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.payouts.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>${Number(p.amount_uyu).toFixed(0)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{p.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.external_ref || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HowItWorks({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Card className={`bg-card/60 border-border/60 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="h-4 w-4 text-primary" /> {t("affiliate.dashboard.how_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div>
          <div className="font-semibold mb-2">{t("affiliate.dashboard.how_commissions")}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-md border border-border/60 p-3">
              <div className="text-xs text-muted-foreground">Starter ($199)</div>
              <div className="text-lg font-bold text-primary">15%</div>
              <div className="text-xs text-muted-foreground">≈ $29 UYU</div>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <div className="text-xs text-muted-foreground">Pro ($949)</div>
              <div className="text-lg font-bold text-primary">30%</div>
              <div className="text-xs text-muted-foreground">≈ $284 UYU</div>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <div className="text-xs text-muted-foreground">Premium ($1.790)</div>
              <div className="text-lg font-bold text-primary">35%</div>
              <div className="text-xs text-muted-foreground">≈ $626 UYU</div>
            </div>
            <div className="rounded-md border border-border/60 p-3">
              <div className="text-xs text-muted-foreground">{t("affiliate.landing.tier_subscription")} ($900/mes)</div>
              <div className="text-lg font-bold text-primary">30%</div>
              <div className="text-xs text-muted-foreground">recurrente, $270/mes</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="font-semibold mb-1">{t("affiliate.dashboard.how_attribution_title")}</div>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{t("affiliate.dashboard.how_attribution_1")}</li>
              <li>{t("affiliate.dashboard.how_attribution_2")}</li>
              <li>{t("affiliate.dashboard.how_attribution_3")}</li>
              <li>{t("affiliate.dashboard.how_attribution_4")}</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-1">{t("affiliate.dashboard.how_cycle_title")}</div>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>{t("affiliate.dashboard.how_cycle_pending")}</li>
              <li>{t("affiliate.dashboard.how_cycle_approved")}</li>
              <li>{t("affiliate.dashboard.how_cycle_paid")}</li>
              <li>{t("affiliate.dashboard.how_cycle_min")}</li>
            </ul>
          </div>
        </div>

        <div>
          <div className="font-semibold mb-1">{t("affiliate.dashboard.tiers_title")}</div>
          <div className="text-muted-foreground">{t("affiliate.dashboard.tiers_text")}</div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t("affiliate.dashboard.disclaimer_title")}</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            {t("affiliate.dashboard.disclaimer_text")}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}