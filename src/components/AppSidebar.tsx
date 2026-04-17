import { Sparkles, History, Image, Shield, Coins } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import knjLogo from "@/assets/knj-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { title: "Generar", url: "/app", icon: Sparkles },
  { title: "Historial", url: "/app/history", icon: History },
  { title: "Galería", url: "/app/gallery", icon: Image },
  { title: "Comprar créditos", url: "/app/pricing", icon: Coins },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 flex items-center gap-2">
          <img src={knjLogo} alt="KNJ IA" className="h-8 w-8 shrink-0 object-contain" />
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight">
              KNJ<span className="text-primary"> IA</span>
            </span>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin"
                      end
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/40 p-2">
        <UserMenu collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}
