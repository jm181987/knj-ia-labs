import { History, Image, Shield, Coins, Library, ChevronDown, BookOpen, Video, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "react-router-dom";
import { useState } from "react";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UserMenu } from "@/components/UserMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES } from "@/lib/wavespeedCatalog";

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const [catalogOpen, setCatalogOpen] = useState(
    location.pathname === "/app" || location.pathname.startsWith("/app/catalog"),
  );
  const [guideOpen, setGuideOpen] = useState(location.pathname.startsWith("/app/guide"));

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const items: { titleKey: string; url: string; icon: typeof Library }[] = [];

  const tail = [
    { titleKey: "nav.history", url: "/app/history", icon: History },
    { titleKey: "nav.gallery", url: "/app/gallery", icon: Image },
    { titleKey: "nav.buyCredits", url: "/app/pricing", icon: Coins },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <Link to="/" className="p-4 flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src={knjLogo} alt="KNJ PRO" className="h-11 w-11 shrink-0 object-contain" />
          {!collapsed && !isMobile && (
            <span className="font-bold text-lg tracking-tight">
              KNJ<span className="text-primary"> PRO</span>
            </span>
          )}
        </Link>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      onClick={handleNavClick}
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Catálogo con submenu de categorías */}
              <Collapsible open={catalogOpen} onOpenChange={setCatalogOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={`hover:bg-accent/50 w-full ${
                        location.pathname.startsWith("/app/catalog") ? "bg-accent text-accent-foreground font-medium" : ""
                      }`}
                    >
                      <Library className="mr-2 h-4 w-4" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{t("nav.catalog")}</span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${catalogOpen ? "rotate-180" : ""}`}
                          />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {CATEGORIES.map((c) => {
                          const url = c.id === "all" ? "/app/catalog" : `/app/catalog?cat=${c.id}`;
                          const active =
                            location.pathname === "/app/catalog" &&
                            ((c.id === "all" && !location.search) ||
                              location.search.includes(`cat=${c.id}`));
                          return (
                            <SidebarMenuSubItem key={c.id}>
                              <SidebarMenuSubButton asChild isActive={active}>
                                <NavLink to={url} onClick={handleNavClick}>
                                  <span className="mr-2">{c.emoji}</span>
                                  <span>{t(`catalog.cat.${c.id}`, c.label)}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>

              <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={`hover:bg-accent/50 w-full ${
                        location.pathname.startsWith("/app/guide") ? "bg-accent text-accent-foreground font-medium" : ""
                      }`}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{t("nav.basicGuide")}</span>
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${guideOpen ? "rotate-180" : ""}`} />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location.pathname === "/app/guide"}>
                            <NavLink to="/app/guide" onClick={handleNavClick}>
                              <span className="mr-2">🖼️</span>
                              <span>{t("catalog.cat.image")}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location.pathname === "/app/guide/videos"}>
                            <NavLink to="/app/guide/videos" onClick={handleNavClick}>
                              <Video className="mr-2 h-3.5 w-3.5" />
                              <span>{t("catalog.cat.video")}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location.pathname === "/app/guide/avatars"}>
                            <NavLink to="/app/guide/avatars" onClick={handleNavClick}>
                              <UserRound className="mr-2 h-3.5 w-3.5" />
                              <span>{t("catalog.cat.avatars")}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>

              {tail.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      onClick={handleNavClick}
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
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
                      onClick={handleNavClick}
                      className="hover:bg-accent/50"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{t("nav.admin")}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/40 p-2 space-y-1">
        {!collapsed && (
          <div className="px-1">
            <LanguageSwitcher variant="outline" />
          </div>
        )}
        <UserMenu collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}
