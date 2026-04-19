import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Sparkles } from "lucide-react";
import { useLowCreditsAlert } from "@/hooks/useLowCreditsAlert";
import { HealthBanner } from "@/components/HealthBanner";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";

export function Layout({ children }: { children: React.ReactNode }) {
  useLowCreditsAlert();
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
            <span>© {new Date().getFullYear()} KNJ PRO</span>
          </footer>
        </div>
        <WhatsAppFloat />
      </div>
    </SidebarProvider>
  );
}
