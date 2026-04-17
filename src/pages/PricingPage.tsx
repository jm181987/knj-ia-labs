import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Coins, Check, Sparkles, ImageIcon, Video } from "lucide-react";
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

interface PricingRow {
  key: string;
  credits: number;
  description: string | null;
}

export default function PricingPage() {
  const { user } = useAuth();
  const { balance } = useCredits();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: pkgs }, { data: prices }] = await Promise.all([
        (supabase as any)
          .from("credit_packages")
          .select("*")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        (supabase as any)
          .from("pricing")
          .select("key, credits, description")
          .order("credits", { ascending: true }),
      ]);
      setPackages((pkgs as Pkg[]) || []);
      setPricing((prices as PricingRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const handleBuy = async (pkg: Pkg) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setBuying(pkg.id);
    try {
      const { data, error } = await supabase.functions.invoke("mp-create-preference", {
        body: { package_id: pkg.id, return_origin: window.location.origin },
      });
      if (error) throw error;
      const url = (data as any)?.init_point;
      if (!url) throw new Error("No se obtuvo URL de Mercado Pago");
      window.location.href = url;
    } catch (e) {
      toast({
        title: "Error iniciando pago",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      setBuying(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
          <Sparkles className="h-4 w-4" /> Recarga de créditos
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Compra créditos para generar</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Pago seguro con Mercado Pago. Acepta tarjetas, Abitab, RedPagos y más.
        </p>
        {user && balance !== null && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
            <Coins className="h-4 w-4 text-primary" />
            <span className="text-sm">Saldo actual:</span>
            <span className="font-bold">{balance} créditos</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay paquetes disponibles. Contacta al administrador.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`relative flex flex-col ${
                pkg.highlighted ? "border-primary shadow-lg shadow-primary/20" : "border-border/60"
              } bg-card/80 backdrop-blur`}
            >
              {pkg.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Más popular</Badge>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                {pkg.description && <CardDescription>{pkg.description}</CardDescription>}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${Number(pkg.price_uyu).toLocaleString("es-UY")}</span>
                    <span className="text-muted-foreground text-sm">UYU</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {(Number(pkg.price_uyu) / pkg.credits).toFixed(2)} UYU por crédito
                  </div>
                </div>
                <div className="flex items-center gap-2 py-3 border-y border-border">
                  <Coins className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{pkg.credits.toLocaleString("es-UY")}</span>
                  <span className="text-muted-foreground">créditos</span>
                </div>
                <ul className="space-y-2 text-sm flex-1">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Generación de imágenes y videos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Sin caducidad</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Pago en pesos uruguayos</span>
                  </li>
                </ul>
                <Button
                  className="w-full"
                  variant={pkg.highlighted ? "default" : "outline"}
                  size="lg"
                  onClick={() => handleBuy(pkg)}
                  disabled={buying === pkg.id}
                >
                  {buying === pkg.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Redirigiendo…
                    </>
                  ) : (
                    "Comprar con Mercado Pago"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="text-center text-xs text-muted-foreground space-y-1 pt-4">
        <p>Procesado de forma segura por Mercado Pago Uruguay.</p>
        <p>Los créditos se acreditan automáticamente al confirmarse el pago.</p>
      </div>
    </div>
  );
}
