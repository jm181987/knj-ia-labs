import { ArrowRight, BookOpen, Coins, Download, History, ImagePlus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

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

export default function BasicGuidePage() {
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
      </section>
    </main>
  );
}