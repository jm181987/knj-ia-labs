import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Coins, Check, Repeat, CalendarClock, Sparkles, Wand2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface Pkg {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_uyu: number;
  highlighted: boolean;
  sort_order: number;
}

const SUB_PRICE = 900;
const SUB_CREDITS = 500;
const MIN_CUSTOM = 80;
const RATIO = 1.99;

export function LandingPricing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("200");
  const customAmountNum = Number(customAmount) || 0;
  const customCredits = customAmountNum >= MIN_CUSTOM ? Math.floor(customAmountNum / RATIO) : 0;

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("credit_packages")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      setPackages((data as Pkg[]) || []);
      setLoading(false);
    })();
  }, []);

  const requireAuth = () => {
    if (!user) {
      navigate("/auth?redirect=/app/pricing");
      return false;
    }
    return true;
  };

  const handleSubscribe = async () => {
    if (!requireAuth()) return;
    setBusy("sub");
    try {
      const { data, error } = await supabase.functions.invoke("mp-create-subscription", { body: {} });
      if (error) throw error;
      const url = (data as any)?.init_point;
      if (!url) throw new Error((data as any)?.error || t("pricing.subErrorTitle"));
      window.location.href = url;
    } catch (e) {
      toast({
        title: t("pricing.subErrorTitle"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      setBusy(null);
    }
  };

  const handleBuy = async (pkg: Pkg) => {
    if (!requireAuth()) return;
    setBusy(pkg.id);
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
      setBusy(null);
    }
  };

  const handleBuyCustom = async () => {
    if (!requireAuth()) return;
    if (customAmountNum < MIN_CUSTOM) {
      toast({ title: t("pricing.invalidAmountTitle"), description: t("pricing.invalidAmountDesc", { min: MIN_CUSTOM }), variant: "destructive" });
      return;
    }
    setBusy("custom");
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
      setBusy(null);
    }
  };

  return (
    <section id="pricing" className="py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs sm:text-sm mb-4">
            <Sparkles className="h-4 w-4" /> {t("pricing.landingBadge")}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {t("pricing.landingTitle1")} <span className="text-gradient">{t("pricing.landingTitleHighlight")}</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            {t("pricing.landingSub")}
          </p>
        </div>

        {/* Subscription card */}
        <Card className="border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-card/80 backdrop-blur shadow-lg shadow-primary/10 relative overflow-hidden mb-8">
          <Badge className="absolute top-4 right-4 gap-1">
            <Repeat className="h-3 w-3" /> {t("pricing.subRecommended")}
          </Badge>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <CalendarClock className="h-5 w-5 text-primary" /> {t("pricing.subTitle")}
            </CardTitle>
            <CardDescription>{t("pricing.subDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
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
              </div>
              <Button size="lg" className="sm:self-end" onClick={handleSubscribe} disabled={busy === "sub"}>
                {busy === "sub" ? (
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
          </CardContent>
        </Card>

        {/* Packages */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : packages.length > 0 ? (
          <>
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">{t("pricing.orBuyOneTime")}</h3>
              <p className="text-sm text-muted-foreground">{t("pricing.orBuyOneTimeSub")}</p>
            </div>
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
                        <span className="text-3xl sm:text-4xl font-bold">
                          ${Number(pkg.price_uyu).toLocaleString("es-UY")}
                        </span>
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
                    <Button
                      className="w-full mt-auto"
                      variant={pkg.highlighted ? "default" : "outline"}
                      size="lg"
                      onClick={() => handleBuy(pkg)}
                      disabled={busy === pkg.id}
                    >
                      {busy === pkg.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("pricing.redirecting")}
                        </>
                      ) : (
                        t("pricing.buy")
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : null}

        {/* Recarga personalizada */}
        <Card className="mt-8 border-primary/40 bg-gradient-to-br from-primary/5 to-card/80 backdrop-blur shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <Wand2 className="h-5 w-5 text-primary" /> {t("pricing.customTitle")}
            </CardTitle>
            <CardDescription>{t("pricing.customDesc", { min: MIN_CUSTOM })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-warning/40 bg-warning/5 text-xs sm:text-sm">
                <Lock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <span>{t("pricing.loginRequiredCustom")}</span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="landing-custom-amount">{t("pricing.amountLabel")}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="landing-custom-amount"
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
                  <div className="text-2xl font-bold leading-none">{customCredits.toLocaleString("es-UY")}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("pricing.creditsEach", { ratio: RATIO.toFixed(2) })}
                  </div>
                </div>
              </div>
              <Button
                size="lg"
                onClick={handleBuyCustom}
                disabled={busy === "custom" || customAmountNum < MIN_CUSTOM}
              >
                {busy === "custom" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t("pricing.redirecting")}
                  </>
                ) : (
                  t("pricing.buy")
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
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
          </CardContent>
        </Card>

        {!user && (
          <p className="text-center text-xs text-muted-foreground mt-6">{t("pricing.loginNotice")}</p>
        )}
      </div>
    </section>
  );
}
