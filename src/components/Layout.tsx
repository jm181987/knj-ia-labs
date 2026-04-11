import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Wallet } from "lucide-react";
import { getBalance } from "@/lib/kling";

export function Layout({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    getBalance().then((res) => {
      if (res.code === 0 && res.data) {
        const total = (res.data as any)?.total_balance ?? (res.data as any)?.balance ?? null;
        setBalance(typeof total === "number" ? total : null);
      }
    }).catch(() => {});
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b px-4 justify-between">
            <SidebarTrigger />
            {balance !== null && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span className="font-medium">{balance.toFixed(2)}</span>
                <span>créditos</span>
              </div>
            )}
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
