import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Shield, Coins, Plus, Minus, Pencil, Package, Receipt, Trash2, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WavespeedBalanceCard } from "@/components/WavespeedBalanceCard";
import { useTranslation } from "react-i18next";

interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  roles: string[];
  balance: number;
}
interface PricingRow { key: string; credits: number; description: string | null }
interface TxRow {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  created_at: string;
  user_email?: string;
}
interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_uyu: number;
  active: boolean;
  highlighted: boolean;
  sort_order: number;
}
interface PaymentRow {
  id: string;
  user_id: string;
  amount_uyu: number;
  credits: number;
  status: string;
  mp_payment_id: string | null;
  created_at: string;
  approved_at: string | null;
  user_email?: string;
}

const emptyPkg: Omit<PackageRow, "id"> = {
  name: "",
  description: "",
  credits: 100,
  price_uyu: 200,
  active: true,
  highlighted: false,
  sort_order: 0,
};

export default function AdminPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [rechargeUser, setRechargeUser] = useState<UserRow | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState("10");
  const [rechargeReason, setRechargeReason] = useState(t("admin.manualRecharge"));
  const [rechargeSign, setRechargeSign] = useState<"+" | "-">("+");
  const [submitting, setSubmitting] = useState(false);

  const [editingPrice, setEditingPrice] = useState<PricingRow | null>(null);
  const [priceValue, setPriceValue] = useState("");

  const [editingPkg, setEditingPkg] = useState<PackageRow | Omit<PackageRow, "id"> | null>(null);
  const [pkgIsNew, setPkgIsNew] = useState(false);

  const [welcomeCredits, setWelcomeCredits] = useState<string>("10");
  const [pricingMarkup, setPricingMarkup] = useState<string>("3");
  const [creditsPerUsd, setCreditsPerUsd] = useState<string>("37");
  const [mpFeePct, setMpFeePct] = useState<string>("7.99");
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);

  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: roles }, { data: credits }, { data: prices }, { data: tx }, { data: pkgs }, { data: pays }, { data: settings }] =
        await Promise.all([
          (supabase as any).from("profiles").select("id, email, display_name, created_at").order("created_at", { ascending: false }),
          (supabase as any).from("user_roles").select("user_id, role"),
          (supabase as any).from("user_credits").select("user_id, balance"),
          (supabase as any).from("pricing").select("key, credits, description").order("key"),
          (supabase as any).from("credit_transactions").select("id, user_id, amount, reason, created_at").order("created_at", { ascending: false }).limit(100),
          (supabase as any).from("credit_packages").select("*").order("sort_order"),
          (supabase as any).from("payments").select("*").order("created_at", { ascending: false }).limit(100),
          (supabase as any).from("app_settings").select("key, value").in("key", ["welcome_credits", "pricing_markup", "pricing_credits_per_usd", "pricing_mp_fee_pct"]),
        ]);

      const balanceMap = new Map<string, number>(((credits as any[]) || []).map((c) => [c.user_id, c.balance]));
      const merged: UserRow[] = ((profiles as any[]) || []).map((p) => ({
        ...p,
        roles: ((roles as any[]) || []).filter((r) => r.user_id === p.id).map((r) => r.role),
        balance: balanceMap.get(p.id) ?? 0,
      }));
      setUsers(merged);
      setPricing((prices as any[]) || []);
      setPackages((pkgs as PackageRow[]) || []);

      const emailMap = new Map<string, string>(((profiles as any[]) || []).map((p) => [p.id, p.email]));
      setTxs(((tx as any[]) || []).map((t) => ({ ...t, user_email: emailMap.get(t.user_id) || t.user_id.slice(0, 8) })));
      setPayments(((pays as PaymentRow[]) || []).map((p) => ({ ...p, user_email: emailMap.get(p.user_id) || p.user_id.slice(0, 8) })));

      const settingsArr = (settings as { key: string; value: unknown }[] | null) || [];
      const settingsMap = new Map(settingsArr.map((s) => [s.key, s.value]));
      if (settingsMap.has("welcome_credits")) setWelcomeCredits(String(settingsMap.get("welcome_credits")));
      if (settingsMap.has("pricing_markup")) setPricingMarkup(String(settingsMap.get("pricing_markup")));
      if (settingsMap.has("pricing_credits_per_usd")) setCreditsPerUsd(String(settingsMap.get("pricing_credits_per_usd")));
      if (settingsMap.has("pricing_mp_fee_pct")) setMpFeePct(String(settingsMap.get("pricing_mp_fee_pct")));
    } catch (e) {
      toast({ title: t("common.error"), description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleSaveWelcomeCredits = async () => {
    const n = parseInt(welcomeCredits);
    if (isNaN(n) || n < 0) {
      toast({ title: t("common.error"), variant: "destructive" });
      return;
    }
    setSavingSettings(true);
    try {
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert({ key: "welcome_credits", value: n }, { onConflict: "key" });
      if (error) throw error;
      toast({ title: t("common.success") });
    } catch (e) {
      toast({ title: t("common.error"), description: String(e), variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSavePricingSettings = async () => {
    const m = parseFloat(pricingMarkup);
    const c = parseFloat(creditsPerUsd);
    const f = parseFloat(mpFeePct);
    if (isNaN(m) || m <= 0 || isNaN(c) || c <= 0 || isNaN(f) || f < 0 || f >= 100) {
      toast({ title: t("common.error"), description: "Valores deben ser positivos y comisión < 100%", variant: "destructive" });
      return;
    }
    setSavingPricing(true);
    try {
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert([
          { key: "pricing_markup", value: m },
          { key: "pricing_credits_per_usd", value: c },
          { key: "pricing_mp_fee_pct", value: f },
        ], { onConflict: "key" });
      if (error) throw error;
      toast({ title: t("common.success"), description: "Precios actualizados. El catálogo se refresca al recargar." });
    } catch (e) {
      toast({ title: t("common.error"), description: String(e), variant: "destructive" });
    } finally {
      setSavingPricing(false);
    }
  };

  const handleRecharge = async () => {
    if (!rechargeUser) return;
    const amount = parseInt(rechargeAmount);
    if (!amount || amount <= 0) {
      toast({ title: t("common.error"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const signed = rechargeSign === "+" ? amount : -amount;
      const { error } = await (supabase as any).rpc("add_credits", {
        _user_id: rechargeUser.id,
        _amount: signed,
        _reason: rechargeReason || t("admin.manualRecharge"),
      });
      if (error) throw error;
      toast({ title: `${signed > 0 ? "+" : ""}${signed} ${t("common.credits")} → ${rechargeUser.email}` });
      setRechargeUser(null);
      setRechargeAmount("10");
      setRechargeReason(t("admin.manualRecharge"));
      await loadAll();
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePrice = async () => {
    if (!editingPrice) return;
    const credits = parseInt(priceValue);
    if (isNaN(credits) || credits < 0) {
      toast({ title: t("common.error"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("pricing")
        .update({ credits, updated_at: new Date().toISOString() })
        .eq("key", editingPrice.key);
      if (error) throw error;
      toast({ title: t("common.success") });
      setEditingPrice(null);
      await loadAll();
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePkg = async () => {
    if (!editingPkg) return;
    if (!editingPkg.name || editingPkg.credits <= 0 || editingPkg.price_uyu <= 0) {
      toast({ title: t("common.error"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: editingPkg.name,
        description: editingPkg.description,
        credits: editingPkg.credits,
        price_uyu: editingPkg.price_uyu,
        active: editingPkg.active,
        highlighted: editingPkg.highlighted,
        sort_order: editingPkg.sort_order,
      };
      if (pkgIsNew) {
        const { error } = await (supabase as any).from("credit_packages").insert(payload);
        if (error) throw error;
      } else {
        const id = (editingPkg as PackageRow).id;
        const { error } = await (supabase as any).from("credit_packages").update(payload).eq("id", id);
        if (error) throw error;
      }
      toast({ title: t("common.success") });
      setEditingPkg(null);
      setPkgIsNew(false);
      await loadAll();
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPassword = async () => {
    if (!pwUser) return;
    if (!pwValue || pwValue.length < 6) {
      toast({ title: t("common.error"), description: t("auth.password"), variant: "destructive" });
      return;
    }
    setPwSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-set-password", {
        body: { user_id: pwUser.id, new_password: pwValue },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: t("common.success"), description: pwUser.email || "" });
      setPwUser(null);
      setPwValue("");
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleDeletePkg = async (id: string) => {
    if (!confirm(t("admin.deletePkgConfirm"))) return;
    try {
      const { error } = await (supabase as any).from("credit_packages").delete().eq("id", id);
      if (error) throw error;
      toast({ title: t("common.success") });
      await loadAll();
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const statusColor = (s: string) => {
    if (s === "approved") return "default";
    if (s === "rejected") return "destructive";
    if (s === "refunded") return "outline";
    return "secondary";
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-primary shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("admin.title")}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">{t("admin.subtitle")}</p>
        </div>
      </div>

      <WavespeedBalanceCard />

      <Tabs defaultValue="users">
        <div className="w-full overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="users">{t("admin.tabUsers")}</TabsTrigger>
            <TabsTrigger value="packages">{t("admin.tabPackages")}</TabsTrigger>
            <TabsTrigger value="pricing">{t("admin.tabPricing")}</TabsTrigger>
            <TabsTrigger value="payments">{t("admin.tabPayments")}</TabsTrigger>
            <TabsTrigger value="transactions">{t("admin.tabTransactions")}</TabsTrigger>
            <TabsTrigger value="settings">{t("admin.tabSettings")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{t("admin.users")}</CardTitle>
              <CardDescription>{loading ? t("admin.loadingShort") : t("admin.usersCount", { count: users.length })}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.name")}</TableHead>
                        <TableHead>{t("admin.email")}</TableHead>
                        <TableHead>{t("admin.role")}</TableHead>
                        <TableHead className="text-right">{t("admin.balance")}</TableHead>
                        <TableHead className="text-right">{t("admin.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium whitespace-nowrap">{u.display_name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{u.email}</TableCell>
                          <TableCell>
                            {u.roles.map((r) => (
                              <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="mr-1">{r}</Badge>
                            ))}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span className="inline-flex items-center gap-1">
                              <Coins className="h-3 w-3 text-primary" /> {u.balance}
                            </span>
                          </TableCell>
                          <TableCell className="text-right space-x-1 whitespace-nowrap">
                            <Button size="sm" variant="outline" onClick={() => setRechargeUser(u)}>
                              <Plus className="h-3 w-3 mr-1" /> {t("admin.recharge")}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setPwUser(u); setPwValue(""); }}>
                              <Key className="h-3 w-3 mr-1" /> {t("admin.password")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> {t("admin.packages")}</CardTitle>
                <CardDescription>{t("admin.packagesDesc")}</CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const recommended = [
                      { name: "Starter", credits: 100, price_uyu: 199, sort_order: 1, highlighted: false, active: true },
                      { name: "Pro", credits: 500, price_uyu: 949, sort_order: 2, highlighted: true, active: true },
                      { name: "Premium", credits: 1500, price_uyu: 2749, sort_order: 3, highlighted: false, active: true },
                      { name: "Ultra", credits: 5000, price_uyu: 8999, sort_order: 4, highlighted: false, active: true },
                    ];
                    try {
                      const { error: delErr } = await (supabase as any).from("credit_packages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                      if (delErr) throw delErr;
                      const { error: insErr } = await (supabase as any).from("credit_packages").insert(recommended);
                      if (insErr) throw insErr;
                      toast({ title: t("common.success") });
                      loadAll();
                    } catch (e) {
                      toast({ title: t("common.error"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
                    }
                  }}
                >
                  {t("admin.applyRecommended")}
                </Button>
                <Button size="sm" onClick={() => { setEditingPkg({ ...emptyPkg }); setPkgIsNew(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> {t("admin.new")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.name")}</TableHead>
                      <TableHead className="text-right">{t("admin.credits")}</TableHead>
                      <TableHead className="text-right">{t("admin.priceUyu")}</TableHead>
                      <TableHead>{t("admin.status")}</TableHead>
                      <TableHead className="text-right">{t("admin.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {p.name}
                          {p.highlighted && <Badge className="ml-2" variant="outline">{t("admin.highlighted")}</Badge>}
                        </TableCell>
                        <TableCell className="text-right font-mono">{p.credits}</TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap">${Number(p.price_uyu).toLocaleString("es-UY")}</TableCell>
                        <TableCell>
                          <Badge variant={p.active ? "default" : "secondary"}>{p.active ? t("admin.active") : t("admin.inactive")}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingPkg(p); setPkgIsNew(false); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeletePkg(p.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {packages.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("admin.noPackagesYet")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>{t("admin.pricingTitle")}</CardTitle>
                <CardDescription>{t("admin.pricingDesc")}</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const wavespeedPricing = [
                    { key: "image_nano-banana-2", credits: 2, description: "Nano Banana 2 (Google)" },
                    { key: "image_seedream-4.5", credits: 3, description: "Seedream 4.5 (ByteDance)" },
                    { key: "image_flux-2", credits: 4, description: "FLUX 2 (Black Forest)" },
                    { key: "image_flux-dev", credits: 2, description: "FLUX.1 Dev (Black Forest)" },
                    { key: "video_sora-2_4_std", credits: 25, description: "Sora 2 · 4s" },
                    { key: "video_sora-2_8_std", credits: 45, description: "Sora 2 · 8s" },
                    { key: "video_sora-2_12_std", credits: 65, description: "Sora 2 · 12s" },
                    { key: "video_veo-3.1_4_std", credits: 30, description: "Veo 3.1 · 4s" },
                    { key: "video_veo-3.1_8_std", credits: 55, description: "Veo 3.1 · 8s" },
                    { key: "video_veo-3.1-i2v_4_std", credits: 30, description: "Veo 3.1 (Image) · 4s" },
                    { key: "video_veo-3.1-i2v_8_std", credits: 55, description: "Veo 3.1 (Image) · 8s" },
                    { key: "video_kling-2.5_5_std", credits: 30, description: "Kling 2.5 Pro · 5s" },
                    { key: "video_kling-2.5_10_std", credits: 55, description: "Kling 2.5 Pro · 10s" },
                    { key: "video_kling-2.5-i2v_5_std", credits: 30, description: "Kling 2.5 (Image) · 5s" },
                    { key: "video_kling-2.5-i2v_10_std", credits: 55, description: "Kling 2.5 (Image) · 10s" },
                    { key: "video_seedance-v2_5_std", credits: 25, description: "Seedance 2.0 · 5s" },
                    { key: "video_seedance-v2_10_std", credits: 45, description: "Seedance 2.0 · 10s" },
                    { key: "video_hailuo-02_6_std", credits: 20, description: "Hailuo 02 · 6s" },
                    { key: "video_hailuo-02_10_std", credits: 35, description: "Hailuo 02 · 10s" },
                    { key: "video_wan-2.7_5_std", credits: 20, description: "WAN 2.7 · 5s" },
                    { key: "video_ltxv_5_std", credits: 15, description: "LTXV · 5s" },
                    { key: "video_higgsfield_5_std", credits: 20, description: "Higgsfield · 5s" },
                  ];
                  const validKeys = new Set(wavespeedPricing.map((p) => p.key));
                  const oldKeys = pricing.map((p) => p.key).filter((k) => !validKeys.has(k));
                  try {
                    if (oldKeys.length > 0) {
                      const { error: delErr } = await (supabase as any).from("pricing").delete().in("key", oldKeys);
                      if (delErr) throw delErr;
                    }
                    const { error: upErr } = await (supabase as any).from("pricing").upsert(wavespeedPricing, { onConflict: "key" });
                    if (upErr) throw upErr;
                    toast({ title: t("common.success") });
                    loadAll();
                  } catch (e) {
                    toast({ title: t("common.error"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
                  }
                }}
              >
                {t("admin.syncPrices")}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.description")}</TableHead>
                      <TableHead className="font-mono text-xs">{t("admin.key")}</TableHead>
                      <TableHead className="text-right">{t("admin.credits")}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pricing.map((p) => (
                      <TableRow key={p.key}>
                        <TableCell className="whitespace-nowrap">{p.description || "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{p.key}</TableCell>
                        <TableCell className="text-right font-mono">{p.credits}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingPrice(p); setPriceValue(String(p.credits)); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> {t("admin.paymentsTitle")}</CardTitle>
              <CardDescription>{t("admin.paymentsCount", { count: payments.length })}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.date")}</TableHead>
                      <TableHead>{t("admin.user")}</TableHead>
                      <TableHead className="text-right">{t("admin.amountUyu")}</TableHead>
                      <TableHead className="text-right">{t("admin.credits")}</TableHead>
                      <TableHead>{t("admin.status")}</TableHead>
                      <TableHead className="font-mono text-xs">{t("admin.mpId")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{p.user_email}</TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap">${Number(p.amount_uyu).toLocaleString("es-UY")}</TableCell>
                        <TableCell className="text-right font-mono">{p.credits}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(p.status) as any}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{p.mp_payment_id || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {payments.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("admin.noPayments")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{t("admin.txTitle")}</CardTitle>
              <CardDescription>{t("admin.txCount", { count: txs.length })}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.date")}</TableHead>
                      <TableHead>{t("admin.user")}</TableHead>
                      <TableHead>{t("admin.reason")}</TableHead>
                      <TableHead className="text-right">{t("admin.change")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txs.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{tx.user_email}</TableCell>
                        <TableCell className="text-sm">{tx.reason}</TableCell>
                        <TableCell className={`text-right font-mono font-medium ${tx.amount > 0 ? "text-green-500" : "text-destructive"}`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount}
                        </TableCell>
                      </TableRow>
                    ))}
                    {txs.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("admin.noTx")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{t("admin.settingsTitle")}</CardTitle>
              <CardDescription>{t("admin.settingsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="welcome-credits">{t("admin.welcomeCredits")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("admin.welcomeCreditsDesc")}
                </p>
                <div className="flex gap-2">
                  <Input
                    id="welcome-credits"
                    type="number"
                    min="0"
                    value={welcomeCredits}
                    onChange={(e) => setWelcomeCredits(e.target.value)}
                  />
                  <Button onClick={handleSaveWelcomeCredits} disabled={savingSettings}>
                    {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Precios del catálogo
              </CardTitle>
              <CardDescription>
                Cálculo automático: <strong>costo USD WaveSpeed × markup × créditos por USD = créditos</strong>.
                Aplica a los 700+ modelos del catálogo dinámico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="pricing-markup">Markup (multiplicador sobre costo real)</Label>
                <p className="text-xs text-muted-foreground">
                  Ej: 3 = cobrás 3× lo que te cuesta WaveSpeed (margen ~66%).
                </p>
                <Input
                  id="pricing-markup"
                  type="number"
                  min="1"
                  step="0.1"
                  value={pricingMarkup}
                  onChange={(e) => setPricingMarkup(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credits-per-usd">Créditos por USD</Label>
                <p className="text-xs text-muted-foreground">
                  Cuántos créditos vale 1 USD. Ej: 37 ≈ USD 0.027 / crédito.
                </p>
                <Input
                  id="credits-per-usd"
                  type="number"
                  min="1"
                  step="0.5"
                  value={creditsPerUsd}
                  onChange={(e) => setCreditsPerUsd(e.target.value)}
                />
              </div>
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs space-y-1">
                <div className="font-medium text-foreground">Ejemplos con la config actual:</div>
                <div className="text-muted-foreground">
                  • Modelo USD 0.05 → {Math.max(1, Math.ceil(0.05 * (parseFloat(pricingMarkup) || 3) * (parseFloat(creditsPerUsd) || 37)))} cr
                </div>
                <div className="text-muted-foreground">
                  • Modelo USD 0.20 → {Math.max(1, Math.ceil(0.20 * (parseFloat(pricingMarkup) || 3) * (parseFloat(creditsPerUsd) || 37)))} cr
                </div>
                <div className="text-muted-foreground">
                  • Modelo USD 0.40 (Sora 2) → {Math.max(1, Math.ceil(0.40 * (parseFloat(pricingMarkup) || 3) * (parseFloat(creditsPerUsd) || 37)))} cr
                </div>
              </div>
              <Button onClick={handleSavePricingSettings} disabled={savingPricing} className="w-full">
                {savingPricing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar precios
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog recarga */}
      <Dialog open={!!rechargeUser} onOpenChange={(o) => !o && setRechargeUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.adjustBalance", { email: rechargeUser?.email || "" })}</DialogTitle>
            <DialogDescription>{t("admin.currentBalanceLabel")} <strong>{rechargeUser?.balance}</strong> {t("common.credits")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant={rechargeSign === "+" ? "default" : "outline"} size="sm" onClick={() => setRechargeSign("+")}>
                <Plus className="h-3 w-3 mr-1" /> {t("admin.add")}
              </Button>
              <Button variant={rechargeSign === "-" ? "destructive" : "outline"} size="sm" onClick={() => setRechargeSign("-")}>
                <Minus className="h-3 w-3 mr-1" /> {t("admin.subtract")}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.amount")}</Label>
              <Input type="number" min="1" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.reason")}</Label>
              <Input value={rechargeReason} onChange={(e) => setRechargeReason(e.target.value)} placeholder={t("admin.reasonPh")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRechargeUser(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleRecharge} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("common.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog setear contraseña */}
      <Dialog open={!!pwUser} onOpenChange={(o) => { if (!o) { setPwUser(null); setPwValue(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.changePassword")}</DialogTitle>
            <DialogDescription>
              {t("admin.changePasswordDesc")} <strong>{pwUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("admin.newPassword")}</Label>
            <Input
              type="text"
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              placeholder={t("admin.newPasswordPh")}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.passwordHint")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPwUser(null); setPwValue(""); }}>{t("common.cancel")}</Button>
            <Button onClick={handleSetPassword} disabled={pwSubmitting}>
              {pwSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("common.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog editar precio */}
      <Dialog open={!!editingPrice} onOpenChange={(o) => !o && setEditingPrice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.editPrice")}</DialogTitle>
            <DialogDescription>{editingPrice?.description || editingPrice?.key}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("admin.credits")}</Label>
            <Input type="number" min="0" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPrice(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleSavePrice} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog editar paquete */}
      <Dialog open={!!editingPkg} onOpenChange={(o) => { if (!o) { setEditingPkg(null); setPkgIsNew(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pkgIsNew ? t("admin.newPackage") : t("admin.editPackage")}</DialogTitle>
            <DialogDescription>{t("admin.packageDialogDesc")}</DialogDescription>
          </DialogHeader>
          {editingPkg && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("admin.name")}</Label>
                <Input
                  value={editingPkg.name}
                  onChange={(e) => setEditingPkg({ ...editingPkg, name: e.target.value })}
                  placeholder={t("admin.namePh")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.descriptionOptional")}</Label>
                <Textarea
                  value={editingPkg.description || ""}
                  onChange={(e) => setEditingPkg({ ...editingPkg, description: e.target.value })}
                  placeholder={t("admin.descriptionPh")}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("admin.credits")}</Label>
                  <Input
                    type="number" min="1"
                    value={editingPkg.credits}
                    onChange={(e) => setEditingPkg({ ...editingPkg, credits: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.priceUyu")}</Label>
                  <Input
                    type="number" min="1" step="0.01"
                    value={editingPkg.price_uyu}
                    onChange={(e) => setEditingPkg({ ...editingPkg, price_uyu: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.sortOrder")}</Label>
                <Input
                  type="number"
                  value={editingPkg.sort_order}
                  onChange={(e) => setEditingPkg({ ...editingPkg, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label>{t("admin.active")}</Label>
                  <p className="text-xs text-muted-foreground">{t("admin.activeDesc")}</p>
                </div>
                <Switch
                  checked={editingPkg.active}
                  onCheckedChange={(v) => setEditingPkg({ ...editingPkg, active: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label>{t("admin.highlighted")}</Label>
                  <p className="text-xs text-muted-foreground">{t("admin.highlightedDesc")}</p>
                </div>
                <Switch
                  checked={editingPkg.highlighted}
                  onCheckedChange={(v) => setEditingPkg({ ...editingPkg, highlighted: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditingPkg(null); setPkgIsNew(false); }}>{t("common.cancel")}</Button>
            <Button onClick={handleSavePkg} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {pkgIsNew ? t("common.create") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
