import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, LogOut, Shield, User as UserIcon, Wallet } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";

export function UserMenu({ collapsed }: { collapsed?: boolean }) {
  const { user, isAdmin, signOut } = useAuth();
  const { balance } = useCredits();
  const navigate = useNavigate();
  const [wsBalance, setWsBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("wavespeed-balance");
        if (error || (data as any)?.error) return;
        if (!cancelled) setWsBalance((data as any)?.balance_usd ?? null);
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isAdmin]);

  if (!user) return null;
  const initials = (user.user_metadata?.display_name || user.email || "?").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 h-auto py-2 px-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-primary/20 text-primary">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col items-start min-w-0 flex-1 gap-0.5">
              <span className="text-sm font-medium truncate w-full">
                {user.user_metadata?.display_name || user.email?.split("@")[0]}
              </span>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium gap-1">
                <Coins className="h-2.5 w-2.5" />
                {balance ?? "—"} créditos
              </Badge>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="h-4 w-4 mr-2" /> Perfil (próximamente)
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onClick={() => navigate("/admin")}>
            <Shield className="h-4 w-4 mr-2" /> Panel admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive">
          <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
