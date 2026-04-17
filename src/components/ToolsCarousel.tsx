import { useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

type Tool = {
  name: string;
  tag: string;
  gradient: string; // tailwind gradient classes
  initials: string;
};

const tools: Tool[] = [
  { name: "Sora 2", tag: "OpenAI", initials: "S2", gradient: "from-zinc-700 to-zinc-900" },
  { name: "Veo 3.1", tag: "Google", initials: "V3", gradient: "from-blue-500 to-indigo-600" },
  { name: "Kling 2.5", tag: "Kuaishou", initials: "K", gradient: "from-violet-500 to-fuchsia-600" },
  { name: "Hailuo 2", tag: "MiniMax", initials: "H2", gradient: "from-orange-500 to-rose-600" },
  { name: "Seedance", tag: "ByteDance", initials: "Sd", gradient: "from-emerald-500 to-teal-600" },
  { name: "Higgsfield", tag: "Higgsfield AI", initials: "Hf", gradient: "from-amber-500 to-orange-600" },
  { name: "Nano Banana", tag: "Google", initials: "NB", gradient: "from-yellow-400 to-amber-500" },
  { name: "LTXV 13B", tag: "Lightricks", initials: "LX", gradient: "from-pink-500 to-purple-600" },
  { name: "Gemini", tag: "Google DeepMind", initials: "G", gradient: "from-sky-500 to-blue-600" },
];

export function ToolsCarousel() {
  const autoplay = useRef(Autoplay({ delay: 1800, stopOnInteraction: false, stopOnMouseEnter: true }));
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: true },
    [autoplay.current],
  );

  useEffect(() => {
    if (!emblaApi) return;
  }, [emblaApi]);

  // Duplicate list for smoother loop
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
          {/* fade edges */}
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
                    <div
                      className={`h-12 w-12 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white font-bold text-lg shadow-md`}
                    >
                      {t.initials}
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
