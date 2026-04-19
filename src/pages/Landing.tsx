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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    q: "¿Cómo funciona el sistema de créditos?",
    a: "KNJ PRO funciona con créditos prepagos: comprás un paquete una sola vez y los usás cuando querés, en cualquier herramienta de la plataforma. No hay suscripciones mensuales ni cobros automáticos.",
  },
  {
    q: "¿En qué moneda se paga?",
    a: "Los pagos son en pesos uruguayos (UYU) a través de Mercado Pago, con factura automática. Podés pagar con tarjeta de crédito, débito o saldo de Mercado Pago.",
  },
  {
    q: "¿Los créditos vencen?",
    a: "No. Tus créditos no tienen fecha de vencimiento. Los usás a tu ritmo, sin presión.",
  },
  {
    q: "¿Puedo comprar más créditos cuando se me terminen?",
    a: "Sí. Podés comprar paquetes adicionales cuando quieras, directamente desde tu panel. Hay distintos tamaños para que elijas el que mejor se adapte a tu uso.",
  },
  {
    q: "¿Puedo usar las creaciones comercialmente?",
    a: "Sí. Las imágenes, videos y audios generados podés usarlos para redes sociales, anuncios, productos, e-commerce, clientes o proyectos personales, sin marca de agua.",
  },
  {
    q: "¿Esto reemplaza herramientas como Midjourney, Kling, Sora o ChatGPT?",
    a: "Sí. KNJ PRO integra los mismos modelos de punta — Sora 2, Veo 3.1, Kling 2.5, Seedance, Nano Banana 2, Flux y muchos más — en un único panel. Accedés a las mismas tecnologías, siempre actualizadas, sin necesidad de suscribirte ni gestionar múltiples plataformas.",
  },
  {
    q: "¿Necesito entender de tecnología o saber usar IA?",
    a: "No. KNJ PRO fue creada para quienes quieren resultados, no complejidad. Describes lo que querés, elegís el modelo y la plataforma se encarga del resto. Sin códigos, sin configuraciones técnicas y sin prompts complicados.",
  },
  {
    q: "¿Necesito escribir prompts de una manera específica?",
    a: "No. Podés escribir normalmente en lenguaje simple. La plataforma entiende tu intención y genera los mejores resultados para imágenes, videos y audio.",
  },
  {
    q: "¿Los modelos se actualizan o quedan desactualizados?",
    a: "Se actualizan constantemente. Cada vez que sale un nuevo modelo de IA o se mejora uno existente, lo integramos a la plataforma sin costo adicional.",
  },
  {
    q: "¿Hay soporte disponible?",
    a: "Sí. Contás con soporte dedicado por WhatsApp y tutoriales para aprender a usar todas las herramientas con facilidad.",
  },
  {
    q: "¿Para quién es ideal KNJ PRO?",
    a: "Creadores de contenido, diseñadores, social media, gestores de tráfico, agencias, pequeñas empresas y cualquier persona que quiera crear imágenes, videos y contenidos profesionales con rapidez y bajo costo.",
  },
  {
    q: "¿Para quién no es?",
    a: "Si te gusta configurar servidores, usar herramientas separadas y gestionar múltiples suscripciones, probablemente no es para vos. KNJ PRO es para quienes valoran la simplicidad, la velocidad y los resultados.",
  },
];

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

      {/* Hero — editorial asymmetric */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 -z-10 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 50% 40% at 20% 0%, hsl(var(--primary) / 0.18), transparent 60%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-6 pt-10 pb-8 grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 lg:col-span-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm border border-primary/30 bg-primary/5 mb-8 font-mono-tech">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t("landing.heroBadge")}
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[0.95] text-balance">
              {t("landing.heroTitle1")}{" "}
              <span className="text-gradient">{t("landing.heroTitleHighlight")}</span>
            </h1>
          </div>
          <div className="col-span-12 lg:col-span-4 lg:pb-4">
            <div className="border-t border-border/80 pt-5 font-mono-tech text-[11px] leading-relaxed">
              <p className="text-muted-foreground/70 mb-4">[ KNJ // PRO · v4.0 ]</p>
              <p className="text-muted-foreground mb-6">{t("landing.heroSub")}</p>
              <div className="space-y-1.5">
                <div className="flex justify-between border-b border-border/60 pb-1">
                  <span className="text-muted-foreground/60 uppercase tracking-wider">Models</span>
                  <span className="tabular-nums">700+</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-1">
                  <span className="text-muted-foreground/60 uppercase tracking-wider">Latency</span>
                  <span className="tabular-nums text-success">~22ms</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-1">
                  <span className="text-muted-foreground/60 uppercase tracking-wider">Status</span>
                  <span className="text-primary uppercase">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 pb-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 border-t border-border/40 pt-5">
          <Link to="/app">
            <Button size="lg" className="gap-2 shadow-elegant rounded-sm font-mono-tech text-xs uppercase tracking-wider">
              <Wand2 className="h-4 w-4" />
              {t("landing.ctaCreate")}
            </Button>
          </Link>
          <a href="#showcase">
            <Button size="lg" variant="outline" className="rounded-sm font-mono-tech text-xs uppercase tracking-wider">
              {t("landing.ctaExamples")}
            </Button>
          </a>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-primary/30 bg-primary/5 font-mono-tech text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("landing.mpBadge")}
          </span>
          <div className="sm:ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono-tech text-muted-foreground">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-3 w-3 fill-warning text-warning" />
              ))}
              <span className="ml-2 uppercase tracking-wider">{t("landing.recommended")}</span>
            </div>
            <span className="hidden sm:flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> {t("landing.securePay")}
            </span>
            <span className="hidden sm:flex items-center gap-1.5 uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5 text-warning" /> {t("landing.instant")}
            </span>
          </div>
        </div>

        {/* Showcase mosaic — asymmetric with technical labels */}
        <div id="showcase" className="max-w-7xl mx-auto px-6 pb-24">
          <div className="flex items-end justify-between mb-6">
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
              [ Output_Archive · Realtime ]
            </span>
            <div className="hidden sm:block flex-1 mx-6 h-px bg-border/50" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
              N=12
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {[
              { type: "video", src: "/showcase/ai-video-1.mp4", poster: "https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=600", code: "VID_001" },
              { type: "image", src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600", code: "IMG_002" },
              { type: "image", src: "https://images.unsplash.com/photo-1542596594-649edbc13630?w=600", code: "IMG_003" },
              { type: "video", src: "https://www.w3schools.com/html/mov_bbb.mp4", poster: "https://images.unsplash.com/photo-1558898479-33c0057a5d12?w=600", code: "VID_004" },
              { type: "image", src: "https://images.unsplash.com/photo-1502764613149-7f1d229e230f?w=600", code: "IMG_005" },
              { type: "image", src: "https://images.unsplash.com/photo-1554080353-a576cf803bda?w=600", code: "IMG_006" },
              { type: "video", src: "/showcase/ai-video-2.mp4", poster: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=600", code: "VID_007" },
              { type: "image", src: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600", code: "IMG_008" },
              { type: "image", src: "https://images.unsplash.com/photo-1526510747491-58f928ec870f?w=600", code: "IMG_009" },
              { type: "video", src: "/showcase/ai-video-3.mp4", poster: "https://images.unsplash.com/photo-1496440737103-cd596325d314?w=600", code: "VID_010" },
              { type: "image", src: "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=600", code: "IMG_011" },
              { type: "image", src: "https://images.unsplash.com/photo-1492288991661-058aa541ff43?w=600", code: "IMG_012" },
            ].map((item, i) => (
              <div
                key={i}
                className={`relative rounded-sm overflow-hidden border border-border/60 bg-card group cursor-pointer transition-all duration-500 ease-out hover:scale-[1.4] hover:z-50 hover:shadow-2xl hover:border-primary/60 ${
                  i === 0 ? "row-span-2 col-span-2" : i === 7 ? "row-span-2 col-span-2" : ""
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
                      className="w-full h-full object-cover aspect-square grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                    />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 backdrop-blur font-mono-tech text-[9px] tracking-wider text-white border border-white/10">
                      ● REC
                    </div>
                  </>
                ) : (
                  <img
                    src={item.src}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover aspect-square grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                  />
                )}
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 backdrop-blur font-mono-tech text-[9px] tracking-wider text-white/80 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.code}
                </div>
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

      {/* FAQ */}
      <section id="faq" className="border-t border-border/60 py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Preguntas frecuentes
            </h2>
            <p className="mt-3 text-muted-foreground">
              Todo lo que necesitás saber antes de empezar.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-border/60"
              >
                <AccordionTrigger className="text-left text-base font-medium hover:no-underline hover:text-primary">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
        <div className="max-w-6xl mx-auto px-6 flex flex-col gap-6 text-sm text-muted-foreground">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src={knjLogo} alt="KNJ PRO" className="h-9 w-9 object-contain" />
              <span>© {new Date().getFullYear()} KNJ PRO</span>
            </div>
            <div className="flex items-center gap-5 flex-wrap justify-center">
              <a href="#features" className="hover:text-foreground transition-colors">{t("nav.features")}</a>
              <a href="#savings" className="hover:text-foreground transition-colors">{t("nav.savings")}</a>
              <Link to="/app" className="hover:text-foreground transition-colors">{t("nav.platform")}</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Términos y Condiciones</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Política de Privacidad</Link>
              <Link to="/upload-policy" className="hover:text-foreground transition-colors">Política de Contenido</Link>
              <Link to="/credits-policy" className="hover:text-foreground transition-colors">Política de Créditos</Link>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/80 text-center max-w-4xl mx-auto leading-relaxed border-t border-border/40 pt-5">
            KNJ PRO es una plataforma independiente que integra modelos de IA vía API. Las marcas mencionadas (OpenAI, Google, Kling, ByteDance, Wavespeed, entre otras) pertenecen a sus respectivos propietarios y no tienen afiliación directa con KNJ PRO. Los valores comparativos son estimaciones basadas en precios públicos de suscripciones individuales.
          </p>
        </div>
      </footer>
    </div>
  );
}
