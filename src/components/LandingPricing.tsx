import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Coins, Check, Repeat, CalendarClock, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Pkg {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_uyu: number;
  highlighted: boolean;
  sort_order: number;
}

const SUB_PRICE = 900;
const SUB_CREDITS = 500;

export function LandingPricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("credit_packages")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      setPackages((data as Pkg[]) || []);
      setLoading(false);
    })();
  }, []);

  const requireAuth = () => {
    if (!user) {
      navigate("/auth?redirect=/app/pricing");
      return false;
    }
    return true;
  };

  const handleSubscribe = async () => {
    if (!requireAuth()) return;
    setBusy("sub");
    try {
      const { data, error } = await supabase.functions.invoke("mp-create-subscription", { body: {} });
      if (error) throw error;
      const url = (data as any)?.init_point;
      if (!url) throw new Error((data as any)?.error || "No se pudo crear la suscripción");
      window.location.href = url;
    } catch (e) {
      toast({
        title: "Error al crear la suscripción",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      setBusy(null);
    }
  };

  const handleBuy = async (pkg: Pkg) => {
    if (!requireAuth()) return;
    setBusy(pkg.id);
    try {
      const { data, error } = await supabase.functions.invoke("mp-create-preference", {
        body: { package_id: pkg.id, return_origin: window.location.origin },
      });
      if (error) throw error;
      const url = (data as any)?.init_point;
      if (!url) throw new Error("No se pudo iniciar el pago");
      window.location.href = url;
    } catch (e) {
      toast({
        title: "Error al iniciar el pago",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      setBusy(null);
    }
  };

  return (
    <section id="pricing" className="border-t border-border/60 py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs sm:text-sm mb-4">
            <Sparkles className="h-4 w-4" /> Planes y precios
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Elegí cómo querés <span className="text-gradient">empezar</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Suscripción mensual o paquetes prepagos sin vencimiento. Pagás en pesos por Mercado Pago.
          </p>
        </div>

        {/* Subscription card */}
        <Card className="border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-card/80 backdrop-blur shadow-lg shadow-primary/10 relative overflow-hidden mb-8">
          <Badge className="absolute top-4 right-4 gap-1">
            <Repeat className="h-3 w-3" /> Recomendado
          </Badge>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <CalendarClock className="h-5 w-5 text-primary" /> Plan mensual
            </CardTitle>
            <CardDescription>
              Suscripción que se renueva automáticamente cada mes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="space-y-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-4xl font-bold">${SUB_PRICE.toLocaleString("es-UY")}</span>
                  <span className="text-muted-foreground">UYU / mes</span>
                </div>
                <div className="flex items-center gap-2 py-2 border-y border-border">
                  <Coins className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{SUB_CREDITS.toLocaleString("es-UY")}</span>
                  <span className="text-muted-foreground">créditos cada mes</span>
                </div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Recarga automática mensual</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Cancelás cuando quieras</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Sin preocuparte por quedarte sin créditos</span>
                  </li>
                </ul>
              </div>
              <Button
                size="lg"
                className="sm:self-end"
                onClick={handleSubscribe}
                disabled={busy === "sub"}
              >
                {busy === "sub" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Redirigiendo...
                  </>
                ) : (
                  <>
                    <Repeat className="h-4 w-4 mr-2" /> Suscribirme
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Packages */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : packages.length > 0 ? (
          <>
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">O comprá créditos por única vez</h3>
              <p className="text-sm text-muted-foreground">Sin vencimiento. Los usás cuando quieras.</p>
            </div>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className={`relative flex flex-col ${
                    pkg.highlighted ? "border-primary shadow-lg shadow-primary/20" : "border-border/60"
                  } bg-card/80 backdrop-blur`}
                >
                  {pkg.highlighted && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Popular</Badge>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl sm:text-2xl">{pkg.name}</CardTitle>
                    {pkg.description && <CardDescription>{pkg.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col space-y-4">
                    <div>
                      <div className="flex items-baseline gap-1 flex-wrap">
                        <span className="text-3xl sm:text-4xl font-bold">
                          ${Number(pkg.price_uyu).toLocaleString("es-UY")}
                        </span>
                        <span className="text-muted-foreground text-sm">UYU</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {(Number(pkg.price_uyu) / pkg.credits).toFixed(2)} por crédito
                      </div>
                    </div>
                    <div className="flex items-center gap-2 py-3 border-y border-border">
                      <Coins className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">{pkg.credits.toLocaleString("es-UY")}</span>
                      <span className="text-muted-foreground">créditos</span>
                    </div>
                    <Button
                      className="w-full mt-auto"
                      variant={pkg.highlighted ? "default" : "outline"}
                      size="lg"
                      onClick={() => handleBuy(pkg)}
                      disabled={busy === pkg.id}
                    >
                      {busy === pkg.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Redirigiendo...
                        </>
                      ) : (
                        "Comprar"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : null}

        {!user && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            Si no tenés cuenta, te pediremos que te registres antes de continuar con el pago.
          </p>
        )}
      </div>
    </section>
  );
}
