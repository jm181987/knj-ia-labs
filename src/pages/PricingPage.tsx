import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Coins, Check, Sparkles, ImageIcon, Video, Wand2, Repeat, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { PayPalButton } from "@/components/PayPalButton";

interface Pkg {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_uyu: number;
  highlighted: boolean;
  sort_order: number;
}

interface PricingRow {
  key: string;
  credits: number;
  description: string | null;
}

export default function PricingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { balance } = useCredits();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("200");
  const [activeSub, setActiveSub] = useState<any>(null);
  const [subscribing, setSubscribing] = useState(false);

  const SUB_PRICE = 900;
  const SUB_CREDITS = 500;
  const MIN_CUSTOM = 80;
  const RATIO = 1.99;
  const SUB_PRICE_USD = 22.5;
  const MIN_CUSTOM_USD = 2;
  const USD_PER_CREDIT = 0.05;
  const customAmountNum = Number(customAmount) || 0;
  const customCredits = customAmountNum >= MIN_CUSTOM ? Math.floor(customAmountNum / RATIO) : 0;
  const [customUsd, setCustomUsd] = useState<string>("10");
  const customUsdNum = Number(customUsd) || 0;

  useEffect(() => {
    (async () => {
      const [{ data: pkgs }, { data: prices }] = await Promise.all([
        (supabase as any)
          .from("credit_packages")
          .select("*")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        (supabase as any)
          .from("pricing")
          .select("key, credits, description")
          .order("credits", { ascending: true }),
      ]);
      setPackages((pkgs as Pkg[]) || []);
      setPricing((prices as PricingRow[]) || []);

      if (user) {
        const { data: sub } = await (supabase as any)
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["authorized", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setActiveSub(sub || null);
      }

      setLoading(false);
    })();
  }, [user]);

  const handleSubscribe = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("mp-create-subscription", {
        body: {},
      });
      if (error) throw error;
      const url = (data as any)?.init_point;
      if (!url) throw new Error((data as any)?.error || "No se pudo crear la suscripción");
      window.location.href = url;
    } catch (e) {
      toast({
        title: t("pricing.subErrorTitle"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      setSubscribing(false);
    }
  };

  const handleBuy = async (pkg: Pkg) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setBuying(pkg.id);
    try {
      const { data, error } = await supabase.functions.invoke("mp-create-preference", {
        body: { package_id: pkg.id, return_origin: window.location.origin },
      });
      if (error) throw error;
      const url = (data as any)?.init_point;
      if (!url) throw new Error(t("pricing.noMpUrl"));
      window.location.href = url;
    } catch (e) {
      toast({
        title: t("pricing.paymentErrorTitle"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      setBuying(null);
    }
  };

  const handleBuyCustom = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (customAmountNum < MIN_CUSTOM) {
      toast({ title: t("pricing.invalidAmountTitle"), description: t("pricing.invalidAmountDesc", { min: MIN_CUSTOM }), variant: "destructive" });
      return;
    }
    setBuying("custom");
    try {
      const { data, error } = await supabase.functions.invoke("mp-create-preference", {
        body: { custom_amount: customAmountNum, return_origin: window.location.origin },
      });
      if (error) throw error;
      const url = (data as any)?.init_point;
      if (!url) throw new Error(t("pricing.noMpUrl"));
      window.location.href = url;
    } catch (e) {
      toast({
        title: t("pricing.paymentErrorTitle"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      setBuying(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
      <div className="text-center space-y-3 px-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs sm:text-sm">
          <Sparkles className="h-4 w-4" /> {t("pricing.badge")}
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">{t("pricing.title")}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
          {t("pricing.subtitle")}
        </p>
        {user && balance !== null && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
            <Coins className="h-4 w-4 text-primary" />
            <span className="text-sm">{t("pricing.currentBalance")}</span>
            <span className="font-bold">{balance} {t("common.credits")}</span>
          </div>
        )}
      </div>

      {!loading && (
        <Card className="border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-card/80 backdrop-blur shadow-lg shadow-primary/10 relative overflow-hidden">
          <Badge className="absolute top-4 right-4 gap-1">
            <Repeat className="h-3 w-3" /> {t("pricing.subTag")}
          </Badge>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <CalendarClock className="h-5 w-5 text-primary" /> {t("pricing.subTitle")}
            </CardTitle>
            <CardDescription>{t("pricing.subDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {activeSub?.status === "authorized" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{t("pricing.subActiveTitle")}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("pricing.subActiveDesc", { credits: SUB_CREDITS.toLocaleString("es-UY") })}
                  {activeSub.next_payment_date && (
                    <> {t("pricing.subNextPayment")} <span className="font-medium text-foreground">{new Date(activeSub.next_payment_date).toLocaleDateString("es-UY")}</span></>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("pricing.subCancelHint")}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-4xl font-bold">${SUB_PRICE.toLocaleString("es-UY")}</span>
                    <span className="text-muted-foreground">{t("pricing.subPerMonth")}</span>
                  </div>
                  <div className="flex items-center gap-2 py-2 border-y border-border">
                    <Coins className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{SUB_CREDITS.toLocaleString("es-UY")}</span>
                    <span className="text-muted-foreground">{t("pricing.subCreditsLabel")}</span>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{t("pricing.subFeat1")}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{t("pricing.subFeat2")}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{t("pricing.subFeat3")}</span>
                    </li>
                  </ul>
                  {activeSub?.status === "pending" && (
                    <p className="text-xs text-warning">
                      {t("pricing.subPending")}
                    </p>
                  )}
                </div>
                <Button
                  size="lg"
                  className="sm:self-end"
                  onClick={handleSubscribe}
                  disabled={subscribing}
                >
                  {subscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("pricing.redirecting")}
                    </>
                  ) : (
                    <>
                      <Repeat className="h-4 w-4 mr-2" /> {t("pricing.subscribe")}
                    </>
                  )}
                </Button>
              </div>
            )}
            {activeSub?.status !== "authorized" && (
              <div className="mt-4 pt-4 border-t border-border/40">
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                  <span>O pagá con PayPal</span>
                  <span className="font-semibold text-foreground">${SUB_PRICE_USD} USD/mes</span>
                </div>
                <PayPalButton mode="subscription" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("pricing.noPackages")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`relative flex flex-col ${
                pkg.highlighted ? "border-primary shadow-lg shadow-primary/20" : "border-border/60"
              } bg-card/80 backdrop-blur`}
            >
              {pkg.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">{t("pricing.popular")}</Badge>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="text-xl sm:text-2xl">{pkg.name}</CardTitle>
                {pkg.description && <CardDescription>{pkg.description}</CardDescription>}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4">
                <div>
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-3xl sm:text-4xl font-bold">${Number(pkg.price_uyu).toLocaleString("es-UY")}</span>
                    <span className="text-muted-foreground text-sm">UYU</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {(Number(pkg.price_uyu) / pkg.credits).toFixed(2)} {t("pricing.perCredit")}
                  </div>
                </div>
                <div className="flex items-center gap-2 py-3 border-y border-border">
                  <Coins className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{pkg.credits.toLocaleString("es-UY")}</span>
                  <span className="text-muted-foreground">{t("common.credits")}</span>
                </div>
                <ul className="space-y-2 text-sm flex-1">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{t("pricing.feat1")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{t("pricing.feat2")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{t("pricing.feat3")}</span>
                  </li>
                </ul>
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    variant={pkg.highlighted ? "default" : "outline"}
                    size="lg"
                    onClick={() => handleBuy(pkg)}
                    disabled={buying === pkg.id}
                  >
                    {buying === pkg.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("pricing.redirecting")}
                      </>
                    ) : (
                      t("pricing.buy")
                    )}
                  </Button>
                  <PayPalButton mode="order" packageId={pkg.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && packages.length > 0 && (
        <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-card/80 backdrop-blur shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <Wand2 className="h-5 w-5 text-primary" /> {t("pricing.customTitle")}
            </CardTitle>
            <CardDescription>
              {t("pricing.customDesc", { min: MIN_CUSTOM })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="custom-amount">{t("pricing.amountLabel")}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="custom-amount"
                    type="number"
                    inputMode="numeric"
                    min={MIN_CUSTOM}
                    step={10}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="pl-7 text-lg font-semibold"
                    placeholder={`${MIN_CUSTOM}`}
                  />
                </div>
                {customAmountNum > 0 && customAmountNum < MIN_CUSTOM && (
                  <p className="text-xs text-destructive">{t("pricing.minError", { min: MIN_CUSTOM })}</p>
                )}
              </div>
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-card border border-border min-w-[180px]">
                <Coins className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="text-2xl font-bold leading-none">
                    {customCredits.toLocaleString("es-UY")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("pricing.creditsEach", { ratio: RATIO.toFixed(2) })}
                  </div>
                </div>
              </div>
              <Button
                size="lg"
                onClick={handleBuyCustom}
                disabled={buying === "custom" || customAmountNum < MIN_CUSTOM}
              >
                {buying === "custom" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("pricing.redirecting")}
                  </>
                ) : (
                  t("pricing.buy")
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-xs text-muted-foreground self-center mr-1">{t("pricing.suggestions")}</span>
              {[100, 200, 500, 1000, 2500, 5000].map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCustomAmount(String(v))}
                >
                  ${v.toLocaleString("es-UY")}
                </Button>
              ))}
            </div>
            <div className="pt-4 mt-4 border-t border-border/40 space-y-2">
              <div className="text-xs text-muted-foreground">O pagá con PayPal en USD</div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor="custom-usd" className="text-xs">Monto USD (mín ${MIN_CUSTOM_USD})</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="custom-usd"
                      type="number"
                      min={MIN_CUSTOM_USD}
                      step={1}
                      value={customUsd}
                      onChange={(e) => setCustomUsd(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="font-semibold">
                    {customUsdNum >= MIN_CUSTOM_USD ? Math.floor(customUsdNum / USD_PER_CREDIT).toLocaleString("es-UY") : 0}
                  </span>
                  <span className="text-xs text-muted-foreground">créditos</span>
                </div>
                <div className="min-w-[200px]">
                  <PayPalButton
                    mode="order"
                    customAmountUsd={customUsdNum}
                    disabled={customUsdNum < MIN_CUSTOM_USD}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && pricing.length > 0 && (
        <Card className="border-border/60 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" /> {t("pricing.costsTitle")}
            </CardTitle>
            <CardDescription>
              {t("pricing.costsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("pricing.colType")}</TableHead>
                    <TableHead>{t("pricing.colModel")}</TableHead>
                    <TableHead className="text-right">{t("pricing.colCredits")}</TableHead>
                    {packages.map((pkg) => (
                      <TableHead key={pkg.id} className="text-right whitespace-nowrap">
                        {pkg.name} ({pkg.credits})
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.map((p) => {
                    const isVideo = p.key.startsWith("video_");
                    return (
                      <TableRow key={p.key}>
                        <TableCell>
                          {isVideo ? (
                            <Badge variant="outline" className="gap-1">
                              <Video className="h-3 w-3" /> {t("history.video")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <ImageIcon className="h-3 w-3" /> {t("history.image")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{p.description || p.key}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {p.credits}
                        </TableCell>
                        {packages.map((pkg) => (
                          <TableCell key={pkg.id} className="text-right font-mono text-muted-foreground">
                            {Math.floor(pkg.credits / p.credits).toLocaleString("es-UY")}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              {t("pricing.tableHint")}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="text-center text-xs text-muted-foreground space-y-1 pt-4">
        <p>{t("pricing.footer1")}</p>
        <p>{t("pricing.footer2")}</p>
      </div>
    </div>
  );
}
