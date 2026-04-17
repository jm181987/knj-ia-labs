import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Shield, Coins, Plus, Minus, Pencil, Package, Receipt, Trash2 } from "lucide-react";
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
interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_uyu: number;
  active: boolean;
  highlighted: boolean;
  sort_order: number;
}
interface PaymentRow {
  id: string;
  user_id: string;
  amount_uyu: number;
  credits: number;
  status: string;
  mp_payment_id: string | null;
  created_at: string;
  approved_at: string | null;
  user_email?: string;
}

const emptyPkg: Omit<PackageRow, "id"> = {
  name: "",
  description: "",
  credits: 100,
  price_uyu: 200,
  active: true,
  highlighted: false,
  sort_order: 0,
};

export default function AdminPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [rechargeUser, setRechargeUser] = useState<UserRow | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState("10");
  const [rechargeReason, setRechargeReason] = useState("Recarga manual");
  const [rechargeSign, setRechargeSign] = useState<"+" | "-">("+");
  const [submitting, setSubmitting] = useState(false);

  const [editingPrice, setEditingPrice] = useState<PricingRow | null>(null);
  const [priceValue, setPriceValue] = useState("");

  const [editingPkg, setEditingPkg] = useState<PackageRow | Omit<PackageRow, "id"> | null>(null);
  const [pkgIsNew, setPkgIsNew] = useState(false);

  const [welcomeCredits, setWelcomeCredits] = useState<string>("10");
  const [savingSettings, setSavingSettings] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: roles }, { data: credits }, { data: prices }, { data: tx }, { data: pkgs }, { data: pays }, { data: settings }] =
        await Promise.all([
          (supabase as any).from("profiles").select("id, email, display_name, created_at").order("created_at", { ascending: false }),
          (supabase as any).from("user_roles").select("user_id, role"),
          (supabase as any).from("user_credits").select("user_id, balance"),
          (supabase as any).from("pricing").select("key, credits, label").order("key"),
          (supabase as any).from("credit_transactions").select("id, user_id, amount, reason, created_at").order("created_at", { ascending: false }).limit(100),
          (supabase as any).from("credit_packages").select("*").order("sort_order"),
          (supabase as any).from("payments").select("*").order("created_at", { ascending: false }).limit(100),
          (supabase as any).from("app_settings").select("key, value").eq("key", "welcome_credits").maybeSingle(),
        ]);

      const balanceMap = new Map<string, number>(((credits as any[]) || []).map((c) => [c.user_id, c.balance]));
      const merged: UserRow[] = ((profiles as any[]) || []).map((p) => ({
        ...p,
        roles: ((roles as any[]) || []).filter((r) => r.user_id === p.id).map((r) => r.role),
        balance: balanceMap.get(p.id) ?? 0,
      }));
      setUsers(merged);
      setPricing((prices as any[]) || []);
      setPackages((pkgs as PackageRow[]) || []);

      const emailMap = new Map<string, string>(((profiles as any[]) || []).map((p) => [p.id, p.email]));
      setTxs(((tx as any[]) || []).map((t) => ({ ...t, user_email: emailMap.get(t.user_id) || t.user_id.slice(0, 8) })));
      setPayments(((pays as PaymentRow[]) || []).map((p) => ({ ...p, user_email: emailMap.get(p.user_id) || p.user_id.slice(0, 8) })));

      if (settings?.value !== undefined && settings?.value !== null) {
        setWelcomeCredits(String(settings.value));
      }
    } catch (e) {
      toast({ title: "Error cargando datos", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleSaveWelcomeCredits = async () => {
    const n = parseInt(welcomeCredits);
    if (isNaN(n) || n < 0) {
      toast({ title: "Valor inválido", description: "Debe ser un número >= 0", variant: "destructive" });
      return;
    }
    setSavingSettings(true);
    try {
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert({ key: "welcome_credits", value: n }, { onConflict: "key" });
      if (error) throw error;
      toast({ title: "Configuración guardada", description: `Nuevos usuarios recibirán ${n} créditos.` });
    } catch (e) {
      toast({ title: "Error guardando", description: String(e), variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

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

  const handleSavePkg = async () => {
    if (!editingPkg) return;
    if (!editingPkg.name || editingPkg.credits <= 0 || editingPkg.price_uyu <= 0) {
      toast({ title: "Completa nombre, créditos (>0) y precio (>0)", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: editingPkg.name,
        description: editingPkg.description,
        credits: editingPkg.credits,
        price_uyu: editingPkg.price_uyu,
        active: editingPkg.active,
        highlighted: editingPkg.highlighted,
        sort_order: editingPkg.sort_order,
      };
      if (pkgIsNew) {
        const { error } = await (supabase as any).from("credit_packages").insert(payload);
        if (error) throw error;
        toast({ title: "Paquete creado" });
      } else {
        const id = (editingPkg as PackageRow).id;
        const { error } = await (supabase as any).from("credit_packages").update(payload).eq("id", id);
        if (error) throw error;
        toast({ title: "Paquete actualizado" });
      }
      setEditingPkg(null);
      setPkgIsNew(false);
      await loadAll();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePkg = async (id: string) => {
    if (!confirm("¿Eliminar este paquete? No afecta pagos ya realizados.")) return;
    try {
      const { error } = await (supabase as any).from("credit_packages").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Paquete eliminado" });
      await loadAll();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const statusColor = (s: string) => {
    if (s === "approved") return "default";
    if (s === "rejected") return "destructive";
    if (s === "refunded") return "outline";
    return "secondary";
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de administración</h1>
          <p className="text-muted-foreground text-sm">Gestiona usuarios, créditos, paquetes, precios y pagos.</p>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="packages">Paquetes</TabsTrigger>
          <TabsTrigger value="pricing">Precios</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
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

        <TabsContent value="packages">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Paquetes de créditos</CardTitle>
                <CardDescription>Visibles en /app/pricing para los usuarios.</CardDescription>
              </div>
              <Button size="sm" onClick={() => { setEditingPkg({ ...emptyPkg }); setPkgIsNew(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nuevo paquete
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Créditos</TableHead>
                    <TableHead className="text-right">Precio (UYU)</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.name}
                        {p.highlighted && <Badge className="ml-2" variant="outline">Destacado</Badge>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{p.credits}</TableCell>
                      <TableCell className="text-right font-mono">${Number(p.price_uyu).toLocaleString("es-UY")}</TableCell>
                      <TableCell>
                        <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Activo" : "Inactivo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingPkg(p); setPkgIsNew(false); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeletePkg(p.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {packages.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Crea tu primer paquete.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
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

        <TabsContent value="payments">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Pagos Mercado Pago</CardTitle>
              <CardDescription>{payments.length} pagos recientes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Monto (UYU)</TableHead>
                    <TableHead className="text-right">Créditos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="font-mono text-xs">MP ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{p.user_email}</TableCell>
                      <TableCell className="text-right font-mono">${Number(p.amount_uyu).toLocaleString("es-UY")}</TableCell>
                      <TableCell className="text-right font-mono">{p.credits}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(p.status) as any}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.mp_payment_id || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin pagos todavía.</TableCell></TableRow>
                  )}
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
              <Input value={rechargeReason} onChange={(e) => setRechargeReason(e.target.value)} placeholder="Ej: Pago efectivo, ajuste, etc." />
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

      {/* Dialog editar paquete */}
      <Dialog open={!!editingPkg} onOpenChange={(o) => { if (!o) { setEditingPkg(null); setPkgIsNew(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pkgIsNew ? "Nuevo paquete" : "Editar paquete"}</DialogTitle>
            <DialogDescription>Define nombre, créditos y precio en pesos uruguayos.</DialogDescription>
          </DialogHeader>
          {editingPkg && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editingPkg.name}
                  onChange={(e) => setEditingPkg({ ...editingPkg, name: e.target.value })}
                  placeholder="Ej: Paquete básico"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={editingPkg.description || ""}
                  onChange={(e) => setEditingPkg({ ...editingPkg, description: e.target.value })}
                  placeholder="Ideal para empezar"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Créditos</Label>
                  <Input
                    type="number" min="1"
                    value={editingPkg.credits}
                    onChange={(e) => setEditingPkg({ ...editingPkg, credits: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Precio (UYU)</Label>
                  <Input
                    type="number" min="1" step="0.01"
                    value={editingPkg.price_uyu}
                    onChange={(e) => setEditingPkg({ ...editingPkg, price_uyu: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Orden de visualización</Label>
                <Input
                  type="number"
                  value={editingPkg.sort_order}
                  onChange={(e) => setEditingPkg({ ...editingPkg, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label>Activo</Label>
                  <p className="text-xs text-muted-foreground">Visible para los usuarios</p>
                </div>
                <Switch
                  checked={editingPkg.active}
                  onCheckedChange={(v) => setEditingPkg({ ...editingPkg, active: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label>Destacado</Label>
                  <p className="text-xs text-muted-foreground">Marca como "Más popular"</p>
                </div>
                <Switch
                  checked={editingPkg.highlighted}
                  onCheckedChange={(v) => setEditingPkg({ ...editingPkg, highlighted: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditingPkg(null); setPkgIsNew(false); }}>Cancelar</Button>
            <Button onClick={handleSavePkg} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {pkgIsNew ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
