import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Shield, Coins, Plus, Minus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  roles: string[];
  balance: number;
}
interface PricingRow { key: string; credits: number; label: string }
interface TxRow {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  created_at: string;
  user_email?: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [rechargeUser, setRechargeUser] = useState<UserRow | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState("10");
  const [rechargeReason, setRechargeReason] = useState("Recarga manual");
  const [rechargeSign, setRechargeSign] = useState<"+" | "-">("+");
  const [submitting, setSubmitting] = useState(false);

  const [editingPrice, setEditingPrice] = useState<PricingRow | null>(null);
  const [priceValue, setPriceValue] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: roles }, { data: credits }, { data: prices }, { data: tx }] =
        await Promise.all([
          (supabase as any).from("profiles").select("id, email, display_name, created_at").order("created_at", { ascending: false }),
          (supabase as any).from("user_roles").select("user_id, role"),
          (supabase as any).from("user_credits").select("user_id, balance"),
          (supabase as any).from("pricing").select("key, credits, label").order("key"),
          (supabase as any).from("credit_transactions").select("id, user_id, amount, reason, created_at").order("created_at", { ascending: false }).limit(100),
        ]);

      const balanceMap = new Map<string, number>(((credits as any[]) || []).map((c) => [c.user_id, c.balance]));
      const merged: UserRow[] = ((profiles as any[]) || []).map((p) => ({
        ...p,
        roles: ((roles as any[]) || []).filter((r) => r.user_id === p.id).map((r) => r.role),
        balance: balanceMap.get(p.id) ?? 0,
      }));
      setUsers(merged);
      setPricing((prices as any[]) || []);

      const emailMap = new Map<string, string>(((profiles as any[]) || []).map((p) => [p.id, p.email]));
      setTxs(((tx as any[]) || []).map((t) => ({ ...t, user_email: emailMap.get(t.user_id) || t.user_id.slice(0, 8) })));
    } catch (e) {
      toast({ title: "Error cargando datos", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleRecharge = async () => {
    if (!rechargeUser) return;
    const amount = parseInt(rechargeAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Cantidad inválida", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const signed = rechargeSign === "+" ? amount : -amount;
      const { error } = await (supabase as any).rpc("add_credits", {
        _user_id: rechargeUser.id,
        _amount: signed,
        _reason: rechargeReason || (signed > 0 ? "Recarga manual" : "Ajuste manual"),
      });
      if (error) throw error;
      toast({ title: `${signed > 0 ? "+" : ""}${signed} créditos aplicados a ${rechargeUser.email}` });
      setRechargeUser(null);
      setRechargeAmount("10");
      setRechargeReason("Recarga manual");
      await loadAll();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePrice = async () => {
    if (!editingPrice) return;
    const credits = parseInt(priceValue);
    if (isNaN(credits) || credits < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("pricing")
        .update({ credits, updated_at: new Date().toISOString() })
        .eq("key", editingPrice.key);
      if (error) throw error;
      toast({ title: "Precio actualizado" });
      setEditingPrice(null);
      await loadAll();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de administración</h1>
          <p className="text-muted-foreground text-sm">Gestiona usuarios, créditos, precios y transacciones.</p>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="pricing">Precios</TabsTrigger>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Usuarios</CardTitle>
              <CardDescription>{loading ? "Cargando..." : `${users.length} usuarios registrados`}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          {u.roles.map((r) => (
                            <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="mr-1">{r}</Badge>
                          ))}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className="inline-flex items-center gap-1">
                            <Coins className="h-3 w-3 text-primary" /> {u.balance}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setRechargeUser(u)}>
                            <Plus className="h-3 w-3 mr-1" /> Recargar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Precios por generación</CardTitle>
              <CardDescription>Costo en créditos por modelo y configuración.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="font-mono text-xs">Key</TableHead>
                    <TableHead className="text-right">Créditos</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.map((p) => (
                    <TableRow key={p.key}>
                      <TableCell>{p.label}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.key}</TableCell>
                      <TableCell className="text-right font-mono">{p.credits}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingPrice(p); setPriceValue(String(p.credits)); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Últimas transacciones</CardTitle>
              <CardDescription>{txs.length} movimientos recientes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Cambio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{t.user_email}</TableCell>
                      <TableCell className="text-sm">{t.reason}</TableCell>
                      <TableCell className={`text-right font-mono font-medium ${t.amount > 0 ? "text-green-500" : "text-destructive"}`}>
                        {t.amount > 0 ? "+" : ""}{t.amount}
                      </TableCell>
                    </TableRow>
                  ))}
                  {txs.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sin transacciones todavía.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog recarga */}
      <Dialog open={!!rechargeUser} onOpenChange={(o) => !o && setRechargeUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar saldo de {rechargeUser?.email}</DialogTitle>
            <DialogDescription>Saldo actual: <strong>{rechargeUser?.balance}</strong> créditos</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant={rechargeSign === "+" ? "default" : "outline"} size="sm" onClick={() => setRechargeSign("+")}>
                <Plus className="h-3 w-3 mr-1" /> Sumar
              </Button>
              <Button variant={rechargeSign === "-" ? "destructive" : "outline"} size="sm" onClick={() => setRechargeSign("-")}>
                <Minus className="h-3 w-3 mr-1" /> Restar
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input type="number" min="1" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input value={rechargeReason} onChange={(e) => setRechargeReason(e.target.value)} placeholder="Ej: Pago Mercadopago #123" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRechargeUser(null)}>Cancelar</Button>
            <Button onClick={handleRecharge} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog editar precio */}
      <Dialog open={!!editingPrice} onOpenChange={(o) => !o && setEditingPrice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar precio</DialogTitle>
            <DialogDescription>{editingPrice?.label}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Créditos</Label>
            <Input type="number" min="0" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPrice(null)}>Cancelar</Button>
            <Button onClick={handleSavePrice} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
