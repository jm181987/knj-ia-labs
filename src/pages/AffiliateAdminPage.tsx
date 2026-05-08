import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AffiliateAdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [s, a, p, c] = await Promise.all([
      supabase.functions.invoke("affiliate-admin", { body: { action: "stats" } }),
      supabase.functions.invoke("affiliate-admin", { body: { action: "list" } }),
      supabase.functions.invoke("affiliate-admin", { body: { action: "list_payouts" } }),
      supabase.functions.invoke("affiliate-admin", { body: { action: "list_commissions" } }),
    ]);
    setStats(s.data);
    setAffiliates((a.data as any)?.affiliates || []);
    setPayouts((p.data as any)?.payouts || []);
    setCommissions((c.data as any)?.commissions || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    await supabase.functions.invoke("affiliate-admin", { body: { action: "set_status", affiliate_id: id, status } });
    toast({ title: "Actualizado" });
    load();
  };
  const deleteAffiliate = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("affiliate-admin", { body: { action: "delete", affiliate_id: id } });
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Afiliado eliminado" });
    load();
  };
  const approvePending = async () => {
    const { data } = await supabase.functions.invoke("affiliate-admin", { body: { action: "approve_pending_commissions" } });
    toast({ title: `Comisiones aprobadas: ${(data as any)?.count ?? 0}` });
    load();
  };
  const approvePayout = async (id: string) => {
    await supabase.functions.invoke("affiliate-admin", { body: { action: "approve_payout", payout_id: id } });
    load();
  };
  const markPaid = async (id: string) => {
    const ref = prompt("Referencia externa (opcional)") || "";
    await supabase.functions.invoke("affiliate-admin", { body: { action: "mark_paid", payout_id: id, external_ref: ref } });
    load();
  };
  const exportCsv = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/affiliate-admin`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: "export_csv" }),
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commissions-${Date.now()}.csv`;
    a.click();
  };

  if (loading) return <div className="grid place-items-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold">Afiliados — Admin</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["Total afiliados", stats?.total_affiliates ?? 0],
          ["Aprobados", stats?.approved ?? 0],
          ["Bloqueados", stats?.blocked ?? 0],
          ["Comisiones $", `$${Number(stats?.total_commissions || 0).toFixed(0)}`],
          ["Pagado $", `$${Number(stats?.paid_payouts || 0).toFixed(0)}`],
        ].map(([l, v], i) => (
          <Card key={i} className="bg-card/60"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-bold">{v}</div></CardContent></Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={approvePending}>Aprobar comisiones pendientes (vencidas)</Button>
        <Button variant="outline" onClick={exportCsv}>Exportar comisiones CSV</Button>
      </div>

      <Tabs defaultValue="affiliates">
        <TabsList>
          <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
          <TabsTrigger value="payouts">Pagos</TabsTrigger>
          <TabsTrigger value="commissions">Comisiones</TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Email</TableHead><TableHead>Estado</TableHead><TableHead>Tier</TableHead><TableHead>Ganado</TableHead><TableHead>Pendiente</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {affiliates.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.code}</TableCell>
                    <TableCell>{a.profile?.email || a.user_id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{a.status}</Badge></TableCell>
                    <TableCell className="capitalize">{a.tier}</TableCell>
                    <TableCell>${Number(a.total_earned).toFixed(0)}</TableCell>
                    <TableCell>${Number(a.pending_balance).toFixed(0)}</TableCell>
                    <TableCell className="space-x-1">
                      {a.status !== "approved" && <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "approved")}>Aprobar</Button>}
                      {a.status !== "blocked" && <Button size="sm" variant="destructive" onClick={() => setStatus(a.id, "blocked")}>Bloquear</Button>}
                      {a.status === "blocked" && <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "approved")}>Desbloquear</Button>}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" title="Eliminar"><Trash2 className="h-3 w-3" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar afiliado {a.code}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminarán también sus clics, referidos, comisiones y pagos asociados. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAffiliate(a.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Afiliado</TableHead><TableHead>Monto</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono">{p.affiliates?.code}</TableCell>
                    <TableCell>${Number(p.amount_uyu).toFixed(0)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{p.status}</Badge></TableCell>
                    <TableCell className="space-x-1">
                      {p.status === "pending" && <Button size="sm" variant="outline" onClick={() => approvePayout(p.id)}>Aprobar</Button>}
                      {p.status !== "paid" && <Button size="sm" onClick={() => markPaid(p.id)}>Marcar pagado</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Afiliado</TableHead><TableHead>Plan</TableHead><TableHead>Tipo</TableHead><TableHead>Comisión</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
              <TableBody>
                {commissions.slice(0, 100).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono">{c.affiliates?.code}</TableCell>
                    <TableCell className="capitalize">{c.plan}</TableCell>
                    <TableCell>{c.type}</TableCell>
                    <TableCell>${Number(c.commission_uyu).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}