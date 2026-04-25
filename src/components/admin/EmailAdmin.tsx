import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Mail, Save, Send, Eye, Trash2, FileText } from "lucide-react";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Cast until generated types include new email_* tables (migration just added).
const supabase = supabaseClient as any;

type Segment =
  | "paid"
  | "pending_failed"
  | "active_subscribers"
  | "registered_no_pay"
  | "all_registered";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "paid", label: "Clientes que pagaron (approved)" },
  { value: "pending_failed", label: "Pagos pendientes / fallidos" },
  { value: "active_subscribers", label: "Suscriptores activos" },
  { value: "registered_no_pay", label: "Registrados sin pagos" },
  { value: "all_registered", label: "Todos los registrados" },
];

interface Template {
  id: string;
  name: string;
  subject: string;
  html: string;
  updated_at: string;
}

interface SendLog {
  id: string;
  campaign_id: string | null;
  segment: string;
  recipient_email: string;
  subject: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const DEFAULT_HTML = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#222">
  <h1 style="font-size:22px;margin:0 0 16px">Hola {{first_name}},</h1>
  <p style="font-size:15px;line-height:1.6">
    Te escribimos para contarte una novedad. Tenés actualmente <strong>{{credits}}</strong> créditos disponibles.
  </p>
  <p style="font-size:15px;line-height:1.6">¡Gracias por confiar en nosotros!</p>
</div>`;

export function EmailAdmin() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [segment, setSegment] = useState<Segment>("paid");

  // Preview/test state
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<{ total: number; sample: any[] } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setTemplates((data || []) as Template[]);
  };

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from("email_sends")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return;
    setLogs((data || []) as SendLog[]);
  };

  useEffect(() => {
    loadTemplates();
    loadLogs();
  }, []);

  const resetEditor = () => {
    setEditingId(null);
    setName("");
    setSubject("");
    setHtml(DEFAULT_HTML);
  };

  const loadTemplate = (t: Template) => {
    setEditingId(t.id);
    setName(t.name);
    setSubject(t.subject);
    setHtml(t.html);
  };

  const saveTemplate = async () => {
    if (!name.trim() || !subject.trim() || !html.trim()) {
      toast({ title: "Faltan datos", description: "Nombre, asunto y HTML son requeridos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    if (editingId) {
      const { error } = await supabase
        .from("email_templates")
        .update({ name, subject, html })
        .eq("id", editingId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Plantilla actualizada" });
      }
    } else {
      const { data, error } = await supabase
        .from("email_templates")
        .insert({ name, subject, html })
        .select()
        .single();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Plantilla creada" });
        if (data) setEditingId((data as any).id);
      }
    }
    setLoading(false);
    loadTemplates();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Eliminada" });
    if (editingId === id) resetEditor();
    loadTemplates();
  };

  const doPreview = async () => {
    if (!subject.trim() || !html.trim()) {
      toast({ title: "Faltan datos", description: "Asunto y HTML requeridos.", variant: "destructive" });
      return;
    }
    setPreviewing(true);
    setPreviewData(null);
    const { data, error } = await supabase.functions.invoke("send-bulk-email", {
      body: { action: "preview", segment, subject, html },
    });
    setPreviewing(false);
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    setPreviewData(data as any);
    setConfirmOpen(true);
  };

  const sendTest = async () => {
    if (!testEmail.trim()) {
      toast({ title: "Email requerido", variant: "destructive" });
      return;
    }
    setTestSending(true);
    const { data, error } = await supabase.functions.invoke("send-bulk-email", {
      body: { action: "test", subject, html, test_email: testEmail, segment },
    });
    setTestSending(false);
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Email de prueba enviado", description: testEmail });
  };

  const doSend = async () => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-bulk-email", {
      body: { action: "send", segment, subject, html, template_id: editingId },
    });
    setSending(false);
    setConfirmOpen(false);
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    const r = data as any;
    toast({
      title: "Envío completado",
      description: `Total: ${r.total} · Enviados: ${r.sent} · Fallidos: ${r.failed}`,
    });
    loadLogs();
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose"><Mail className="h-3 w-3 mr-1" />Componer</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-3 w-3 mr-1" />Plantillas ({templates.length})</TabsTrigger>
          <TabsTrigger value="logs">Historial ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" /> {editingId ? "Editando plantilla" : "Nueva campaña"}
              </CardTitle>
              <CardDescription>
                Placeholders disponibles:{" "}
                <code className="text-xs">{"{{name}}"}</code>,{" "}
                <code className="text-xs">{"{{first_name}}"}</code>,{" "}
                <code className="text-xs">{"{{email}}"}</code>,{" "}
                <code className="text-xs">{"{{credits}}"}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nombre interno de la plantilla</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Recordatorio de pago" />
                </div>
                <div>
                  <Label>Segmento de destinatarios</Label>
                  <Select value={segment} onValueChange={(v) => setSegment(v as Segment)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEGMENTS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Asunto</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Hola {{first_name}}, novedades para vos" />
              </div>

              <div>
                <Label>HTML del email</Label>
                <Textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  className="font-mono text-xs min-h-[280px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Vista previa renderizada</Label>
                  <div className="border rounded-md p-3 bg-white min-h-[200px] max-h-[400px] overflow-auto">
                    <iframe
                      title="preview"
                      srcDoc={html}
                      className="w-full h-[380px] border-0 bg-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Probar envío (opcional)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                    <Button onClick={sendTest} disabled={testSending} variant="outline">
                      {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Test
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Envía un solo email a la dirección que indiques con datos de muestra.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={saveTemplate} disabled={loading} variant="outline">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingId ? "Guardar cambios" : "Guardar plantilla"}
                </Button>
                <Button onClick={doPreview} disabled={previewing}>
                  {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Previsualizar y enviar
                </Button>
                {editingId && (
                  <Button variant="ghost" onClick={resetEditor}>Nueva campaña</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Plantillas guardadas</CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no creaste ninguna plantilla.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Asunto</TableHead>
                      <TableHead>Actualizada</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.subject}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(t.updated_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => loadTemplate(t)}>Cargar</Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}>
                            <Trash2 className="h-4 w-4" />
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

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Historial de envíos</CardTitle>
              <CardDescription>Últimos 200 envíos individuales.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Asunto</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{l.recipient_email}</TableCell>
                      <TableCell className="text-sm max-w-[280px] truncate">{l.subject}</TableCell>
                      <TableCell><Badge variant="outline">{l.segment}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={l.status === "sent" ? "default" : "destructive"}>
                          {l.status}
                        </Badge>
                        {l.error_message && (
                          <div className="text-xs text-destructive mt-1 max-w-[260px] truncate" title={l.error_message}>
                            {l.error_message}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar envío masivo</DialogTitle>
            <DialogDescription>
              Se enviará a <strong>{previewData?.total ?? 0}</strong> destinatarios del segmento{" "}
              <Badge variant="outline">{SEGMENTS.find((s) => s.value === segment)?.label}</Badge>.
            </DialogDescription>
          </DialogHeader>
          {previewData && previewData.sample.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Primeros destinatarios (con asunto renderizado):</p>
              <div className="border rounded-md p-3 max-h-60 overflow-auto text-sm space-y-2 bg-muted/30">
                {previewData.sample.map((s: any, i: number) => (
                  <div key={i} className="border-b pb-2 last:border-0">
                    <div className="font-mono text-xs">{s.email} <span className="text-muted-foreground">({s.name})</span></div>
                    <div className="text-sm">{s.subject_rendered}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {previewData?.total === 0 && (
            <p className="text-sm text-destructive">No hay destinatarios en este segmento.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>Cancelar</Button>
            <Button onClick={doSend} disabled={sending || (previewData?.total ?? 0) === 0}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Confirmar y enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}