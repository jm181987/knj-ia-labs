import { Link } from "react-router-dom";
import { Sparkles, TrendingUp, Wallet, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function AffiliateLanding() {
  const { t } = useTranslation();
  const tiers = [
    { name: t("affiliate.landing.tier_starter"), price: "$199 UYU", commission: "15%", note: t("affiliate.landing.note_one_time") },
    { name: t("affiliate.landing.tier_pro"), price: "$949 UYU", commission: "30%", note: t("affiliate.landing.note_one_time") },
    { name: t("affiliate.landing.tier_premium"), price: "$1.790 UYU", commission: "35%", note: t("affiliate.landing.note_one_time") },
    { name: t("affiliate.landing.tier_subscription"), price: "$900 UYU/mes", commission: "30%", note: t("affiliate.landing.note_recurring") },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-background/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-bold">KNJ <span className="text-primary">IA</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Button asChild variant="default"><Link to="/auth?redirect=/app/affiliate">{t("affiliate.landing.cta_become")}</Link></Button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" /> {t("affiliate.landing.badge")}
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          {t("affiliate.landing.title_pre")} <span className="text-primary">{t("affiliate.landing.title_highlight")}</span> {t("affiliate.landing.title_post")}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("affiliate.landing.subtitle")}</p>
        <div className="flex justify-center gap-3 pt-4">
          <Button size="lg" asChild><Link to="/auth?redirect=/app/affiliate">{t("affiliate.landing.cta_start")}</Link></Button>
          <Button size="lg" variant="outline" asChild><a href="#planes">{t("affiliate.landing.cta_view")}</a></Button>
        </div>
      </section>

      <section id="planes" className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">{t("affiliate.landing.structure_title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {tiers.map(tier => (
            <Card key={tier.name} className="bg-card/60 border-border/60">
              <CardContent className="p-6 space-y-2 text-center">
                <div className="text-sm text-muted-foreground">{tier.name}</div>
                <div className="text-2xl font-bold">{tier.price}</div>
                <div className="text-3xl font-bold text-primary">{tier.commission}</div>
                <div className="text-xs text-muted-foreground">{tier.note}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20 grid md:grid-cols-3 gap-6">
        {[
          { icon: Users, title: t("affiliate.landing.feat1_title"), text: t("affiliate.landing.feat1_text") },
          { icon: Wallet, title: t("affiliate.landing.feat2_title"), text: t("affiliate.landing.feat2_text") },
          { icon: ShieldCheck, title: t("affiliate.landing.feat3_title"), text: t("affiliate.landing.feat3_text") },
        ].map((f, i) => (
          <Card key={i} className="bg-card/60 border-border/60">
            <CardContent className="p-6 space-y-3">
              <f.icon className="h-6 w-6 text-primary" />
              <div className="font-semibold">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.text}</div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
