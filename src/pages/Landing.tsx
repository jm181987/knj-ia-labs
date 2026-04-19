import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Wand2,
  Video,
  Image as ImageIcon,
  Zap,
  ShieldCheck,
  Star,
  Check,
  X,
  ArrowRight,
} from "lucide-react";
import knjLogo from "@/assets/knj-logo.png";
import { ToolsCarousel } from "@/components/ToolsCarousel";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TestimonialsSection } from "@/components/TestimonialsSection";

export default function Landing() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col">
      {/* Promo banner */}
      <div
        className="text-center text-xs sm:text-sm font-medium py-2 px-4 text-white"
        style={{ backgroundImage: "var(--gradient-banner)" }}
      >
        <Sparkles className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
        {t("landing.promo")}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-background/60 border-b border-border/60">
        <div className="max-w-6xl mx-auto h-16 px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={knjLogo} alt="KNJ PRO" className="h-12 w-12 object-contain" />
            <span className="hidden sm:inline font-bold text-lg tracking-tight">
              KNJ<span className="text-gradient"> PRO</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t("nav.features")}</a>
            <a href="#savings" className="hover:text-foreground transition-colors">{t("nav.savings")}</a>
            <a href="#showcase" className="hover:text-foreground transition-colors">{t("nav.showcase")}</a>
            <a href="#faq" className="hover:text-foreground transition-colors">{t("nav.faq")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/app">
              <Button variant="ghost" size="sm">{t("common.enter")}</Button>
            </Link>
            <Link to="/app">
              <Button size="sm" className="gap-1.5">
                {t("common.start")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary) / 0.25), transparent 60%)",
          }}
        />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("landing.heroBadge")}
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.02]">
            {t("landing.heroTitle1")} <span className="text-gradient">{t("landing.heroTitleHighlight")}</span><br className="hidden sm:block" />
            {t("landing.heroTitle2")}
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("landing.heroSub")}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link to="/app">
              <Button size="lg" className="gap-2 shadow-elegant">
                <Wand2 className="h-4 w-4" />
                {t("landing.ctaCreate")}
              </Button>
            </Link>
            <a href="#showcase">
              <Button size="lg" variant="outline">
                {t("landing.ctaExamples")}
              </Button>
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-warning text-warning" />
              ))}
              <span className="ml-2">{t("landing.recommended")}</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-success" /> {t("landing.securePay")}
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-warning" /> {t("landing.instant")}
            </span>
          </div>
        </div>

        {/* Showcase mosaic */}
        <div id="showcase" className="max-w-6xl mx-auto px-6 pb-24">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { type: "video", src: "/showcase/ai-video-1.mp4", poster: "https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=600" },
              { type: "image", src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600" },
              { type: "image", src: "https://images.unsplash.com/photo-1542596594-649edbc13630?w=600" },
              { type: "video", src: "https://www.w3schools.com/html/mov_bbb.mp4", poster: "https://images.unsplash.com/photo-1558898479-33c0057a5d12?w=600" },
              { type: "image", src: "https://images.unsplash.com/photo-1502764613149-7f1d229e230f?w=600" },
              { type: "image", src: "https://images.unsplash.com/photo-1554080353-a576cf803bda?w=600" },
              { type: "video", src: "/showcase/ai-video-2.mp4", poster: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=600" },
              { type: "image", src: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600" },
              { type: "image", src: "https://images.unsplash.com/photo-1526510747491-58f928ec870f?w=600" },
              { type: "video", src: "/showcase/ai-video-3.mp4", poster: "https://images.unsplash.com/photo-1496440737103-cd596325d314?w=600" },
              { type: "image", src: "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=600" },
              { type: "image", src: "https://images.unsplash.com/photo-1492288991661-058aa541ff43?w=600" },
            ].map((item, i) => (
              <div
                key={i}
                className={`relative rounded-xl overflow-hidden border border-border/60 bg-card group cursor-pointer transition-all duration-500 ease-out hover:scale-150 hover:z-50 hover:shadow-2xl hover:border-primary/60 ${
                  i === 0 || i === 7 ? "row-span-2 col-span-2" : ""
                }`}
              >
                {item.type === "video" ? (
                  <>
                    <video
                      src={item.src}
                      poster={item.poster}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover aspect-square"
                    />
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur text-[10px] font-medium text-white flex items-center gap-1 transition-opacity group-hover:opacity-0">
                      <Video className="h-2.5 w-2.5" />
                      VIDEO
                    </div>
                  </>
                ) : (
                  <img
                    src={item.src}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover aspect-square"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools carousel */}
      <ToolsCarousel />

      {/* Features */}
      <section id="features" className="border-t border-border/60 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {t("landing.featuresTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              {t("landing.featuresSub")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Video, title: t("landing.feat1Title"), desc: t("landing.feat1Desc") },
              { icon: ImageIcon, title: t("landing.feat2Title"), desc: t("landing.feat2Desc") },
              { icon: Zap, title: t("landing.feat3Title"), desc: t("landing.feat3Desc") },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6 hover:border-primary/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center mb-4 shadow-elegant">
                  <f.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Savings comparison */}
      <section id="savings" className="border-t border-border/60 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {t("landing.savingsTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              {t("landing.savingsSub")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
              <div className="text-xs uppercase tracking-wider text-destructive font-semibold">
                {t("landing.marketCost")}
              </div>
              <h3 className="text-xl font-semibold mt-1">{t("landing.separateSubs")}</h3>
              <ul className="mt-5 space-y-3 text-sm">
                {[
                  ["AI video generation", "≈ $50/mo"],
                  ["AI image generation", "≈ $35/mo"],
                  ["Text intelligence", "≈ $25/mo"],
                  ["Multiple logins & limits", "Zero integration"],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-start gap-3">
                    <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 flex justify-between gap-3">
                      <span>{k}</span>
                      <span className="text-muted-foreground">{v}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-5 border-t border-border/60 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("landing.totalMonthly")}</span>
                <span className="text-2xl font-bold text-destructive">$140+/mo</span>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6 shadow-elegant relative overflow-hidden">
              <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
              <div className="text-xs uppercase tracking-wider text-primary font-semibold">
                KNJ PRO
              </div>
              <h3 className="text-xl font-semibold mt-1">{t("landing.allInOne")}</h3>
              <ul className="mt-5 space-y-3 text-sm">
                {[
                  t("landing.feat1Desc"),
                  t("landing.feat2Desc"),
                  t("landing.feat3Desc"),
                ].map((k) => (
                  <li key={k} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
              <Link to="/app" className="block mt-6">
                <Button className="w-full gap-2">
                  {t("landing.ctaAccess")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/60 py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
            {t("landing.finalCta1")} <span className="text-gradient">{t("landing.finalCtaHighlight")}</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            {t("landing.finalCtaSub")}
          </p>
          <Link to="/app" className="inline-block mt-8">
            <Button size="lg" className="gap-2 shadow-elegant">
              <Sparkles className="h-4 w-4" />
              {t("landing.ctaPlatform")}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={knjLogo} alt="KNJ PRO" className="h-9 w-9 object-contain" />
            <span>© {new Date().getFullYear()} KNJ PRO</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hover:text-foreground transition-colors">{t("nav.features")}</a>
            <a href="#savings" className="hover:text-foreground transition-colors">{t("nav.savings")}</a>
            <Link to="/app" className="hover:text-foreground transition-colors">{t("nav.platform")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
