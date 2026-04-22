import { ArrowRight, BookOpen, Coins, Download, Film, History, ImagePlus, Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import nanoBananaLogo from "@/assets/logos/nano-banana.png";

const steps = [
  {
    icon: ImagePlus,
    title: "Elegí una herramienta",
    description: "Entrá al catálogo y seleccioná el modelo que mejor se adapte a tu imagen, video, avatar o mejora.",
  },
  {
    icon: Sparkles,
    title: "Escribí un prompt claro",
    description: "Indicá sujeto, estilo, acción, formato y detalles importantes. Mientras más específico, mejor resultado.",
  },
  {
    icon: Coins,
    title: "Revisá el costo",
    description: "Cada modelo muestra su costo en créditos antes de generar para que controles tu saldo.",
  },
  {
    icon: History,
    title: "Seguí el progreso",
    description: "Tus trabajos aparecen en Historial con su estado: pendiente, procesando, completado o error.",
  },
  {
    icon: Download,
    title: "Descargá tus resultados",
    description: "Cuando la generación esté lista, abrila desde Historial o Galería y guardá el archivo final.",
  },
];

const promptBlocks = [
  {
    title: "1. Armá el prompt por bloques",
    copy: "Ordená la idea de lo más importante a lo secundario: sujeto, acción, entorno, estilo, cámara, luz y restricciones.",
    example:
      "Retrato editorial de una emprendedora uruguaya sosteniendo un producto de skincare, interior luminoso, fondo limpio, fotografía realista, lente 50mm, luz suave lateral, colores naturales, sin texto ni logos.",
  },
  {
    title: "2. Decí qué conservar y qué cambiar",
    copy: "Cuando edites una imagen, separá lo intocable de lo que querés modificar para evitar resultados impredecibles.",
    example:
      "Mantener rostro, pose y ropa. Cambiar el fondo por un estudio minimalista beige, mejorar iluminación, agregar sombra natural, conservar proporciones reales.",
  },
  {
    title: "3. Usá restricciones simples",
    copy: "Las restricciones reducen intentos fallidos. Pedí explícitamente evitar texto, marcas de agua, dedos extra, desenfoque o fondos cargados.",
    example:
      "Sin texto, sin watermark, sin manos deformes, sin objetos duplicados, sin fondo desordenado, no cambiar identidad del sujeto.",
  },
];

const quickTemplates = [
  "Foto de producto: [producto] sobre [superficie], fondo [tipo], luz [tipo], estilo [marca], cámara [plano], sin texto.",
  "Retrato: [persona] en [lugar], expresión [emoción], ropa [detalle], luz [tipo], lente [mm], realista, mantener rasgos naturales.",
  "Edición: mantener [elementos], cambiar [elementos], agregar [detalle], estilo [referencia visual], resultado limpio y coherente.",
];

const videoPromptBlocks = [
  {
    title: "1. Abrí con movimiento en los primeros segundos",
    copy: "Los videos cortos necesitan enganchar rápido: empezá con una acción clara, cambio visual o cámara en movimiento.",
    example:
      "Video vertical 9:16, una taza de café gira sobre una mesa mientras vapor forma una silueta suave, cámara macro acercándose, luz cálida de mañana, movimiento fluido, duración 5 segundos, loop perfecto.",
  },
  {
    title: "2. Indicá cámara, ritmo y duración",
    copy: "Definí si querés zoom, travelling, paneo, cámara lenta, cortes rápidos o una toma continua para reducir resultados aleatorios.",
    example:
      "Toma continua de 6 segundos, cámara dolly-in lenta hacia un perfume sobre acrílico transparente, reflejos elegantes, fondo oscuro, partículas sutiles, sin texto, sin manos.",
  },
  {
    title: "3. Pensá el final como bucle",
    copy: "Si el video será para redes, pedí que el último cuadro conecte con el primero para que se repita de forma natural.",
    example:
      "Animación de zapatilla deportiva flotando y girando 360 grados, luces de estudio, fondo limpio, final idéntico al inicio para loop seamless, estilo comercial premium.",
  },
];

const videoTemplates = [
  "Video viral: [sujeto] haciendo [acción impactante], cámara [movimiento], estilo [realista/3D/cinemático], duración [segundos], formato 9:16, loop suave.",
  "Producto: [producto] en [escenario], movimiento [giro/zoom/travelling], iluminación [tipo], textura [detalle], sin texto, sin logos extra, final limpio.",
  "Historia corta: inicio [gancho], desarrollo [acción], cierre [transformación], cámara [plano], ritmo [lento/rápido], ambiente [música/energía visual].",
];

export default function BasicGuidePage() {
  const { pathname } = useLocation();
  const isVideoGuide = pathname.endsWith("/videos");
  const activeBlocks = isVideoGuide ? videoPromptBlocks : promptBlocks;
  const activeTemplates = isVideoGuide ? videoTemplates : quickTemplates;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-5 border-b border-border/60 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" /> Guía básica
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Cómo empezar a crear en KNJ PRO
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              Un recorrido rápido para elegir modelos, preparar prompts, administrar créditos y encontrar tus resultados.
            </p>
          </div>
          <Button asChild className="w-full gap-2 sm:w-auto">
            <Link to="/app/catalog">
              Ir al catálogo <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-muted-foreground">Paso {index + 1}</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
              <p className="mt-2 leading-7 text-muted-foreground">{step.description}</p>
            </article>
          ))}
        </div>

        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Tips para mejores resultados</h2>
          <ul className="mt-4 grid gap-3 text-muted-foreground sm:grid-cols-2">
            <li>• Usá descripciones concretas: escena, iluminación, cámara y estilo.</li>
            <li>• Evitá prompts contradictorios o demasiado largos.</li>
            <li>• Si subís una referencia, verificá que sea clara y de buena calidad.</li>
            <li>• Descargá tus creaciones importantes: se conservan por tiempo limitado.</li>
          </ul>
        </section>

        <section className="grid gap-6 border-t border-border/60 pt-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={nanoBananaLogo} alt="Nano Banana" className="h-12 w-12 rounded-md object-contain" />
              <div>
                <p className="text-sm font-medium text-primary">Guía para {isVideoGuide ? "videos" : "imágenes"}</p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {isVideoGuide ? "Videos con más gancho y mejor movimiento" : "Menos intentos, prompts más claros"}
                </h2>
              </div>
            </div>
            <p className="leading-7 text-muted-foreground">
              {isVideoGuide
                ? "Para crear videos con más precisión, indicá acción, cámara, duración, ritmo, formato y cómo debe terminar la escena. Eso reduce intentos y mejora la coherencia."
                : "Para crear imágenes con más precisión, tratá el prompt como una receta visual: primero definí qué debe aparecer, después cómo debe verse y al final qué errores evitar."}
            </p>
            <Button asChild variant="secondary" className="gap-2">
              <Link to={isVideoGuide ? "/app/catalog?cat=video" : "/app/catalog?cat=image"}>
                Probar modelos de {isVideoGuide ? "video" : "imagen"} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4">
            {activeBlocks.map((block) => (
              <article key={block.title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <h3 className="font-semibold tracking-tight text-foreground">{block.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{block.copy}</p>
                <div className="mt-4 rounded-md bg-muted p-4 text-sm leading-6 text-foreground">
                  {block.example}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Plantillas rápidas</h2>
          <div className="mt-4 grid gap-3">
            {activeTemplates.map((template) => (
              <div key={template} className="rounded-md bg-muted p-4 text-sm leading-6 text-muted-foreground">
                {template}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}