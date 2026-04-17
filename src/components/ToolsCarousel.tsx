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
};

const tools: Tool[] = [
  { name: "Sora 2", tag: "OpenAI", logo: openaiLogo },
  { name: "Veo 3.1", tag: "Google", logo: googleLogo },
  { name: "Kling 2.5", tag: "Kuaishou", logo: klingLogo },
  { name: "Hailuo 2", tag: "MiniMax", logo: hailuoLogo },
  { name: "Seedance", tag: "ByteDance", logo: seedanceLogo },
  { name: "Higgsfield", tag: "Higgsfield AI", logo: higgsfieldLogo },
  { name: "Nano Banana", tag: "Google", logo: nanoBananaLogo },
  { name: "LTXV 13B", tag: "Lightricks", logo: ltxvLogo },
  { name: "Gemini", tag: "Google DeepMind", logo: geminiLogo },
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
            <div className="flex gap-4">
              {list.map((t, i) => (
                <div
                  key={`${t.name}-${i}`}
                  className="shrink-0 basis-[180px] sm:basis-[200px]"
                >
                  <div className="group h-32 rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-4 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:shadow-elegant transition-all">
                    <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shadow-sm overflow-hidden">
                      <img
                        src={t.logo}
                        alt={`${t.name} logo`}
                        loading="lazy"
                        width={48}
                        height={48}
                        className="h-10 w-10 object-contain"
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
