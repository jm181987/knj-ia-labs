import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, TrendingUp, Wallet, Users, MousePointerClick, DollarSign, Award } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Stats = { clicks: number; referrals: number; conversions: number; gross_sales_uyu: number; pending_balance: number; approved_balance: number; total_paid: number; total_earned: number };

export default function AffiliateDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [code, setCode] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("affiliate-self", { body: { action: "me" } });
    setData(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const register = async () => {
    const { data, error } = await supabase.functions.invoke("affiliate-self", { body: { action: "register", code } });
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Solicitud enviada", description: "Tu cuenta de afiliado quedó pendiente de aprobación." });
    load();
  };

  const requestPayout = async () => {
    const { data, error } = await supabase.functions.invoke("affiliate-self", { body: { action: "request_payout" } });
    if (error || (data as any)?.error) {
      toast({ title: "No se pudo solicitar el retiro", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Retiro solicitado" });
    load();
  };

  if (loading) return <div className="grid place-items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const aff = data?.affiliate;
  if (!aff) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="bg-card/60 border-border/60">
          <CardHeader><CardTitle>Únete al programa de afiliados</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Elegí un código único (3-32 caracteres, letras/números/guiones).</p>
            <Input placeholder="tu-codigo" value={code} onChange={e => setCode(e.target.value)} maxLength={32} />
            <Button onClick={register} disabled={code.length < 3}>Solicitar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats: Stats = data.stats;
  const link = `${window.location.origin}/?ref=${aff.code}`;

  const StatCard = ({ icon: Icon, label, value, hint }: any) => (
    <Card className="bg-card/60 border-border/60">
      <CardContent className="p-5 space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panel de afiliado</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={aff.status === "approved" ? "default" : "secondary"}>{aff.status}</Badge>
            <Badge variant="outline" className="capitalize"><Award className="h-3 w-3 mr-1" /> {aff.tier}</Badge>
          </div>
        </div>
        <Button onClick={requestPayout} disabled={aff.status !== "approved"}>
          <Wallet className="h-4 w-4 mr-2" /> Solicitar retiro
        </Button>
      </div>

      <Card className="bg-gradient-to-br from-primary/15 to-transparent border-primary/30">
        <CardContent className="p-6 space-y-3">
          <div className="text-sm text-muted-foreground">Tu link de referido</div>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={link} className="flex-1 min-w-[260px] bg-background" />
            <Button onClick={() => { navigator.clipboard.writeText(link); toast({ title: "Copiado" }); }}>
              <Copy className="h-4 w-4 mr-2" /> Copiar
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">Código: <span className="font-mono">{aff.code}</span></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={MousePointerClick} label="Clics" value={stats.clicks} />
        <StatCard icon={Users} label="Referidos" value={stats.referrals} />
        <StatCard icon={TrendingUp} label="Conversiones" value={stats.conversions} />
        <StatCard icon={DollarSign} label="Ventas generadas" value={`$${Math.round(stats.gross_sales_uyu)}`} hint="UYU" />
        <StatCard icon={Wallet} label="Saldo pendiente" value={`$${stats.pending_balance.toFixed(0)}`} hint="aprobándose" />
        <StatCard icon={Wallet} label="Saldo aprobado" value={`$${stats.approved_balance.toFixed(0)}`} hint="listo a retirar" />
        <StatCard icon={Wallet} label="Total pagado" value={`$${stats.total_paid.toFixed(0)}`} />
        <StatCard icon={TrendingUp} label="Total ganado" value={`$${stats.total_earned.toFixed(0)}`} />
      </div>

      <Card className="bg-card/60 border-border/60">
        <CardHeader><CardTitle>Comisiones recientes</CardTitle></CardHeader>
        <CardContent>
          {(data.commissions || []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Aún no tenés comisiones.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Plan</TableHead><TableHead>Tipo</TableHead><TableHead>Bruto</TableHead><TableHead>%</TableHead><TableHead>Comisión</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.commissions.slice(0, 20).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{c.plan}</TableCell>
                    <TableCell>{c.type === "recurring" ? "Recurrente" : "Único"}</TableCell>
                    <TableCell>${Number(c.gross_amount_uyu).toFixed(0)}</TableCell>
                    <TableCell>{(Number(c.rate) * 100).toFixed(0)}%</TableCell>
                    <TableCell className="font-semibold text-primary">${Number(c.commission_uyu).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/60 border-border/60">
        <CardHeader><CardTitle>Historial de pagos</CardTitle></CardHeader>
        <CardContent>
          {(data.payouts || []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Sin pagos todavía.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Monto</TableHead><TableHead>Estado</TableHead><TableHead>Referencia</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.payouts.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>${Number(p.amount_uyu).toFixed(0)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{p.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.external_ref || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}