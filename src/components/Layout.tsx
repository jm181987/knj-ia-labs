import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Sparkles, Monitor } from "lucide-react";
import { useLowCreditsAlert } from "@/hooks/useLowCreditsAlert";
import { HealthBanner } from "@/components/HealthBanner";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { useIsMobile } from "@/hooks/use-mobile";

export function Layout({ children }: { children: React.ReactNode }) {
  useLowCreditsAlert();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center bg-background">
        <div className="max-w-md mx-auto space-y-5">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Monitor className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Usá <span className="text-gradient">KNJ PRO</span> en tu PC
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Por ahora, las herramientas de generación no están optimizadas para mobile.
            Para una mejor experiencia, abrí KNJ PRO desde una computadora o notebook.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Estamos trabajando en una versión móvil completa muy pronto.
          </p>
        </div>
        <WhatsAppFloat />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <HealthBanner />
          {/* Promo banner */}
          <div
            className="text-center text-xs sm:text-sm font-medium py-2 px-4 text-white"
            style={{ backgroundImage: "var(--gradient-banner)" }}
          >
            <Sparkles className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            Nuevos modelos disponibles — crea videos cinemáticos con IA
          </div>
          <header className="h-14 flex items-center border-b border-border/60 px-4 backdrop-blur-md bg-background/60 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="ml-auto text-xs text-muted-foreground">
              Powered by <span className="text-gradient font-semibold">KNJ PRO</span>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-6 lg:p-10 overflow-auto">{children}</main>
          <footer className="border-t border-border/60 py-4 px-6 text-center text-xs text-muted-foreground">
            <a href="/terms" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
              Términos y Condiciones
            </a>
            <span className="mx-2">•</span>
            <a href="/privacy" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
              Política de Privacidad
            </a>
            <span className="mx-2">•</span>
            <a href="/upload-policy" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
              Política de Contenido
            </a>
            <span className="mx-2">•</span>
            <a href="/credits-policy" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
              Política de Créditos
            </a>
            <span className="mx-2">•</span>
            <span>© {new Date().getFullYear()} KNJ PRO</span>
          </footer>
        </div>
        <WhatsAppFloat />
      </div>
    </SidebarProvider>
  );
}
