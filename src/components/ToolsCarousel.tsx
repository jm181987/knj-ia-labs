import { useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

import openaiLogo from "@/assets/logos/openai.png";
import googleLogo from "@/assets/logos/google.png";
import klingLogo from "@/assets/logos/kling.png";
import hailuoLogo from "@/assets/logos/hailuo.png";
import seedanceLogo from "@/assets/logos/seedance.png";
import higgsfieldLogo from "@/assets/logos/higgsfield.png";
import nanoBananaLogo from "@/assets/logos/nano-banana.png";
import ltxvLogo from "@/assets/logos/ltxv.png";
import geminiLogo from "@/assets/logos/gemini.png";

type Tool = {
  name: string;
  tag: string;
  logo: string;
  glow: string; // rgb glow color
};

const tools: Tool[] = [
  { name: "Sora 2",      tag: "OpenAI",          logo: openaiLogo,     glow: "255,255,255" },
  { name: "Veo 3.1",     tag: "Google",          logo: googleLogo,     glow: "66,133,244" },
  { name: "Kling 2.5",   tag: "Kuaishou",        logo: klingLogo,      glow: "168,85,247" },
  { name: "Hailuo 2",    tag: "MiniMax",         logo: hailuoLogo,     glow: "56,189,248" },
  { name: "Seedance",    tag: "ByteDance",       logo: seedanceLogo,   glow: "16,185,129" },
  { name: "Higgsfield",  tag: "Higgsfield AI",   logo: higgsfieldLogo, glow: "249,115,22" },
  { name: "Nano Banana", tag: "Google",          logo: nanoBananaLogo, glow: "250,204,21" },
  { name: "LTXV 13B",    tag: "Lightricks",      logo: ltxvLogo,       glow: "236,72,153" },
  { name: "Gemini",      tag: "Google DeepMind", logo: geminiLogo,     glow: "99,102,241" },
];

export function ToolsCarousel() {
  const autoplay = useRef(Autoplay({ delay: 1800, stopOnInteraction: false, stopOnMouseEnter: true }));
  const [emblaRef] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: true },
    [autoplay.current],
  );

  const list = [...tools, ...tools];

  return (
    <section className="border-t border-border/60 py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-medium mb-4">
            Modelos integrados
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Herramientas <span className="text-gradient">disponibles</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Accede a los modelos de IA más potentes del mercado en un solo panel.
          </p>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-background to-transparent" />

          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex gap-4 py-6">
              {list.map((t, i) => (
                <div
                  key={`${t.name}-${i}`}
                  className="shrink-0 basis-[180px] sm:basis-[200px]"
                >
                  <div
                    className="group relative h-36 rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-4 flex flex-col items-center justify-center gap-2 transition-all duration-300 hover:scale-105"
                    style={{
                      boxShadow: `0 0 0 1px rgba(${t.glow},0.15), 0 8px 32px -8px rgba(${t.glow},0.35)`,
                    }}
                  >
                    {/* Glow background */}
                    <div
                      className="absolute -inset-px rounded-2xl opacity-30 group-hover:opacity-60 transition-opacity blur-xl -z-10"
                      style={{ background: `radial-gradient(circle at center, rgba(${t.glow},0.6), transparent 70%)` }}
                    />
                    <div
                      className="h-14 w-14 flex items-center justify-center"
                      style={{
                        filter: `drop-shadow(0 0 6px rgba(${t.glow},0.9)) drop-shadow(0 0 14px rgba(${t.glow},0.55))`,
                      }}
                    >
                      <img
                        src={t.logo}
                        alt={`${t.name} logo`}
                        loading="lazy"
                        width={56}
                        height={56}
                        className="h-14 w-14 object-contain"
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-[11px] text-muted-foreground">{t.tag}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
