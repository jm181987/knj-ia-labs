import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  roles: string[];
}

export default function AdminPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("id, email, display_name, created_at")
          .order("created_at", { ascending: false });
        if (pErr) throw pErr;

        const { data: roles, error: rErr } = await supabase
          .from("user_roles")
          .select("user_id, role");
        if (rErr) throw rErr;

        const merged: ProfileRow[] = (profiles || []).map((p) => ({
          ...p,
          roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
        }));
        setUsers(merged);
      } catch (e) {
        toast({ title: "Error cargando usuarios", description: String(e), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel de administración</h1>
          <p className="text-muted-foreground text-sm">Gestiona usuarios, roles y créditos.</p>
        </div>
      </div>

      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>{loading ? "Cargando..." : `${users.length} usuarios registrados`}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">Aún no hay usuarios registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Registrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {u.roles.map((r) => (
                        <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="mr-1">
                          {r}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed border-border/60 bg-muted/20">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            🚧 Próximamente: gestión de créditos, recargas manuales y configuración de precios.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
