import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Wallet } from "lucide-react";
import { getBalance } from "@/lib/kling";

interface ResourcePack {
  resource_pack_name: string;
  total_quantity: number;
  remaining_quantity: number;
  status: string;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [packs, setPacks] = useState<ResourcePack[]>([]);

  useEffect(() => {
    getBalance().then((res) => {
      if (res.code === 0 && res.data) {
        const d = res.data as any;
        const infos = d?.resource_pack_subscribe_infos || d?.data?.resource_pack_subscribe_infos || [];
        setPacks(infos.filter((p: ResourcePack) => p.status === "online"));
      }
    }).catch(() => {});
  }, []);

  const totalRemaining = packs.reduce((sum, p) => sum + p.remaining_quantity, 0);
  const totalQuantity = packs.reduce((sum, p) => sum + p.total_quantity, 0);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b px-4 justify-between">
            <SidebarTrigger />
            {packs.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground" title={packs.map(p => `${p.resource_pack_name}: ${p.remaining_quantity}/${p.total_quantity}`).join('\n')}>
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{totalRemaining}</span>
                <span>/ {totalQuantity} créditos</span>
              </div>
            )}
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
