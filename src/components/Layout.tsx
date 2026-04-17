import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Sparkles } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Promo banner */}
          <div
            className="text-center text-xs sm:text-sm font-medium py-2 px-4 text-white"
            style={{ backgroundImage: "var(--gradient-banner)" }}
          >
            <Sparkles className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            Kling v1.6 ya disponible — crea videos cinemáticos con IA
          </div>
          <header className="h-14 flex items-center border-b border-border/60 px-4 backdrop-blur-md bg-background/60 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="ml-auto text-xs text-muted-foreground">
              Powered by <span className="text-gradient font-semibold">Kling AI</span>
            </div>
          </header>
          <main className="flex-1 p-6 lg:p-10 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
