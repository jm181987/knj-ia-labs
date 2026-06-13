import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Wallet, AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function WavespeedBalanceCard() {
  const { session, loading: authLoading, isAdmin } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = async () => {
    if (authLoading) return;
    if (!isAdmin) {
      setError("No autorizado");
      return;
    }
    if (!session?.access_token) {
      setError("Sesión no disponible");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log("WavespeedBalanceCard: Initializing load...");
      console.log("WavespeedBalanceCard: Invoking edge function wavespeed-balance...");
      const { data, error: invokeError } = await supabase.functions.invoke("wavespeed-balance", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });
      
      if (invokeError) {
        console.error("WavespeedBalanceCard: Invoke error:", invokeError);
        throw invokeError;
      }
      if ((data as any)?.error) {
        console.error("WavespeedBalanceCard: Error from function body:", (data as any).error);
        throw new Error((data as any).error);
      }
      console.log("WavespeedBalanceCard: Success, balance:", (data as any)?.balance_usd);
      setBalance((data as any)?.balance_usd ?? null);
      setUpdatedAt(new Date());
    } catch (e) {
      console.error("WavespeedBalanceCard: Catch error:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin && session?.access_token) load();
  }, [authLoading, isAdmin, session?.access_token]);

  const lowBalance = balance !== null && balance < 5;

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <CardTitle className="text-base">Saldo WaveSpeed</CardTitle>
            <CardDescription className="text-xs">
              Crédito disponible en tu cuenta del proveedor
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" asChild>
            <a href="https://wavespeed.ai/top-up" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" /> Recargar
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-bold font-mono">
              {balance === null ? "—" : `$${balance.toFixed(2)}`}
              <span className="text-base text-muted-foreground ml-1">USD</span>
            </span>
            {lowBalance && <Badge variant="destructive">Saldo bajo</Badge>}
            {updatedAt && (
              <span className="text-xs text-muted-foreground">
                Actualizado {updatedAt.toLocaleTimeString("es-UY")}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
