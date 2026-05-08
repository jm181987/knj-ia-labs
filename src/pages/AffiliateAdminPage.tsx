import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Trash2, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AffiliateAdminPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [s, a, p, c] = await Promise.all([
      supabase.functions.invoke("affiliate-admin", { body: { action: "stats" } }),
      supabase.functions.invoke("affiliate-admin", { body: { action: "list" } }),
      supabase.functions.invoke("affiliate-admin", { body: { action: "list_payouts" } }),
      supabase.functions.invoke("affiliate-admin", { body: { action: "list_commissions" } }),
    ]);
    setStats(s.data);
    setAffiliates((a.data as any)?.affiliates || []);
    setPayouts((p.data as any)?.payouts || []);
    setCommissions((c.data as any)?.commissions || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    await supabase.functions.invoke("affiliate-admin", { body: { action: "set_status", affiliate_id: id, status } });
    toast({ title: t("affiliate.admin.updated") });
    load();
  };
  const deleteAffiliate = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("affiliate-admin", { body: { action: "delete", affiliate_id: id } });
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: t("affiliate.admin.deleted") });
    load();
  };
  const approvePending = async () => {
    const { data } = await supabase.functions.invoke("affiliate-admin", { body: { action: "approve_pending_commissions" } });
    toast({ title: t("affiliate.admin.approved_count", { count: (data as any)?.count ?? 0 }) });
    load();
  };
  const approvePayout = async (id: string) => {
    await supabase.functions.invoke("affiliate-admin", { body: { action: "approve_payout", payout_id: id } });
    load();
  };
  const markPaid = async (id: string) => {
    const ref = prompt(t("affiliate.admin.external_ref_prompt")) || "";
    await supabase.functions.invoke("affiliate-admin", { body: { action: "mark_paid", payout_id: id, external_ref: ref } });
    load();
  };
  const exportCsv = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/affiliate-admin`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: "export_csv" }),
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commissions-${Date.now()}.csv`;
    a.click();
  };

  if (authLoading) return <div className="grid place-items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!isAdmin) {
    return (
      <div className="grid place-items-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
          <h2 className="text-lg font-semibold">{t("affiliate.admin.access_restricted")}</h2>
          <p className="text-sm text-muted-foreground">{t("affiliate.admin.access_desc")}</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="grid place-items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold">{t("affiliate.admin.title")}</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          [t("affiliate.admin.stat_total"), stats?.total_affiliates ?? 0],
          [t("affiliate.admin.stat_approved"), stats?.approved ?? 0],
          [t("affiliate.admin.stat_blocked"), stats?.blocked ?? 0],
          [t("affiliate.admin.stat_commissions"), `$${Number(stats?.total_commissions || 0).toFixed(0)}`],
          [t("affiliate.admin.stat_paid"), `$${Number(stats?.paid_payouts || 0).toFixed(0)}`],
        ].map(([l, v], i) => (
          <Card key={i} className="bg-card/60"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-bold">{v}</div></CardContent></Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={approvePending}>{t("affiliate.admin.approve_pending")}</Button>
        <Button variant="outline" onClick={exportCsv}>{t("affiliate.admin.export_csv")}</Button>
      </div>

      <Tabs defaultValue="affiliates">
        <TabsList>
          <TabsTrigger value="affiliates">{t("affiliate.admin.tab_affiliates")}</TabsTrigger>
          <TabsTrigger value="payouts">{t("affiliate.admin.tab_payouts")}</TabsTrigger>
          <TabsTrigger value="commissions">{t("affiliate.admin.tab_commissions")}</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("affiliate.admin.col_code")}</TableHead><TableHead>{t("affiliate.admin.col_email")}</TableHead><TableHead>{t("affiliate.admin.col_status")}</TableHead><TableHead>{t("affiliate.admin.col_tier")}</TableHead><TableHead>{t("affiliate.admin.col_earned")}</TableHead><TableHead>{t("affiliate.admin.col_pending")}</TableHead><TableHead>{t("affiliate.admin.col_actions")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {affiliates.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.code}</TableCell>
                    <TableCell>{a.profile?.email || a.user_id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{a.status}</Badge></TableCell>
                    <TableCell className="capitalize">{a.tier}</TableCell>
                    <TableCell>${Number(a.total_earned).toFixed(0)}</TableCell>
                    <TableCell>${Number(a.pending_balance).toFixed(0)}</TableCell>
                    <TableCell className="space-x-1">
                      {a.status !== "approved" && <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "approved")}>{t("affiliate.admin.approve")}</Button>}
                      {a.status !== "blocked" && <Button size="sm" variant="destructive" onClick={() => setStatus(a.id, "blocked")}>{t("affiliate.admin.block")}</Button>}
                      {a.status === "blocked" && <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "approved")}>{t("affiliate.admin.unblock")}</Button>}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" title={t("affiliate.admin.delete")}><Trash2 className="h-3 w-3" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("affiliate.admin.delete_title", { code: a.code })}</AlertDialogTitle>
                            <AlertDialogDescription>{t("affiliate.admin.delete_desc")}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("affiliate.admin.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAffiliate(a.id)}>{t("affiliate.admin.delete")}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("affiliate.admin.col_date")}</TableHead><TableHead>{t("affiliate.admin.col_affiliate")}</TableHead><TableHead>{t("affiliate.admin.col_amount")}</TableHead><TableHead>{t("affiliate.admin.col_status")}</TableHead><TableHead>{t("affiliate.admin.col_actions")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono">{p.affiliates?.code}</TableCell>
                    <TableCell>${Number(p.amount_uyu).toFixed(0)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{p.status}</Badge></TableCell>
                    <TableCell className="space-x-1">
                      {p.status === "pending" && <Button size="sm" variant="outline" onClick={() => approvePayout(p.id)}>{t("affiliate.admin.approve")}</Button>}
                      {p.status !== "paid" && <Button size="sm" onClick={() => markPaid(p.id)}>{t("affiliate.admin.mark_paid")}</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("affiliate.admin.col_date")}</TableHead><TableHead>{t("affiliate.admin.col_affiliate")}</TableHead><TableHead>{t("affiliate.admin.col_plan")}</TableHead><TableHead>{t("affiliate.admin.col_type")}</TableHead><TableHead>{t("affiliate.admin.col_commission")}</TableHead><TableHead>{t("affiliate.admin.col_status")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {commissions.slice(0, 100).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono">{c.affiliates?.code}</TableCell>
                    <TableCell className="capitalize">{c.plan}</TableCell>
                    <TableCell>{c.type}</TableCell>
                    <TableCell>${Number(c.commission_uyu).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}