import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Upload, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  message: string;
  photo_url: string | null;
  active: boolean;
  sort_order: number;
  instagram_url?: string | null;
  facebook_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  website_url?: string | null;
  message_en?: string | null;
  message_pt?: string | null;
  role_en?: string | null;
  role_pt?: string | null;
}

const empty: Omit<Testimonial, "id"> = {
  name: "",
  role: "",
  message: "",
  photo_url: "",
  active: true,
  sort_order: 0,
  instagram_url: "",
  facebook_url: "",
  linkedin_url: "",
  twitter_url: "",
  tiktok_url: "",
  youtube_url: "",
  website_url: "",
  message_en: "",
  message_pt: "",
  role_en: "",
  role_pt: "",
};

export function TestimonialsAdmin() {
  const { toast } = useToast();
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<Omit<Testimonial, "id">>(empty);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("testimonials")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setItems((data as Testimonial[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({
      name: t.name, role: t.role || "", message: t.message,
      photo_url: t.photo_url || "", active: t.active, sort_order: t.sort_order,
      instagram_url: t.instagram_url || "",
      facebook_url: t.facebook_url || "",
      linkedin_url: t.linkedin_url || "",
      twitter_url: t.twitter_url || "",
      tiktok_url: t.tiktok_url || "",
      youtube_url: t.youtube_url || "",
      website_url: t.website_url || "",
      message_en: t.message_en || "",
      message_pt: t.message_pt || "",
      role_en: t.role_en || "",
      role_pt: t.role_pt || "",
    });
    setOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("testimonials").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("testimonials").getPublicUrl(path);
      setForm((f) => ({ ...f, photo_url: data.publicUrl }));
    } catch (e: any) {
      toast({ title: "Error subiendo foto", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.message.trim()) {
      toast({ title: "Faltan datos", description: "Nombre y mensaje son obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      role: form.role?.trim() || null,
      message: form.message.trim(),
      photo_url: form.photo_url?.trim() || null,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
      instagram_url: form.instagram_url?.trim() || null,
      facebook_url: form.facebook_url?.trim() || null,
      linkedin_url: form.linkedin_url?.trim() || null,
      twitter_url: form.twitter_url?.trim() || null,
      tiktok_url: form.tiktok_url?.trim() || null,
      youtube_url: form.youtube_url?.trim() || null,
      website_url: form.website_url?.trim() || null,
      message_en: form.message_en?.trim() || null,
      message_pt: form.message_pt?.trim() || null,
      role_en: form.role_en?.trim() || null,
      role_pt: form.role_pt?.trim() || null,
    };
    const { error } = editing
      ? await (supabase as any).from("testimonials").update(payload).eq("id", editing.id)
      : await (supabase as any).from("testimonials").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Actualizado" : "Creado" });
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta recomendación?")) return;
    const { error } = await (supabase as any).from("testimonials").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Eliminada" });
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-warning" /> Recomendaciones</CardTitle>
          <CardDescription>Aparecen en la landing page (solo activas)</CardDescription>
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Nueva</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin recomendaciones aún. Creá la primera.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-4 flex gap-3">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={t.photo_url || undefined} />
                  <AvatarFallback>{t.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">{t.name}</div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  {t.role && <div className="text-xs text-muted-foreground">{t.role}</div>}
                  <p className="text-sm mt-1.5 line-clamp-3">{t.message}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className={t.active ? "text-success" : "text-muted-foreground"}>
                      {t.active ? "Activa" : "Oculta"}
                    </span>
                    <span className="text-muted-foreground">orden: {t.sort_order}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar recomendación" : "Nueva recomendación"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={form.photo_url || undefined} />
                  <AvatarFallback>{form.name.charAt(0) || "?"}</AvatarFallback>
                </Avatar>
                <label className="cursor-pointer">
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                  <Button asChild size="sm" variant="outline" disabled={uploading}>
                    <span className="gap-1.5">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Subir foto
                    </span>
                  </Button>
                </label>
              </div>

              <div>
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} />
              </div>
              <div>
                <Label>Cargo / empresa</Label>
                <Input value={form.role || ""} onChange={(e) => setForm({ ...form, role: e.target.value })} maxLength={150} placeholder="Ej: CEO, Acme Inc." />
              </div>
              <div>
                <Label>Mensaje *</Label>
                <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={500} rows={4} />
              </div>
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">Traducciones (opcional)</Label>
                <div className="grid gap-2">
                  <div>
                    <Label className="text-xs">Cargo (EN)</Label>
                    <Input value={form.role_en || ""} onChange={(e) => setForm({ ...form, role_en: e.target.value })} maxLength={150} placeholder="Role in English" />
                  </div>
                  <div>
                    <Label className="text-xs">Mensaje (EN)</Label>
                    <Textarea value={form.message_en || ""} onChange={(e) => setForm({ ...form, message_en: e.target.value })} maxLength={500} rows={3} placeholder="Message in English" />
                  </div>
                  <div>
                    <Label className="text-xs">Cargo (PT)</Label>
                    <Input value={form.role_pt || ""} onChange={(e) => setForm({ ...form, role_pt: e.target.value })} maxLength={150} placeholder="Cargo em português" />
                  </div>
                  <div>
                    <Label className="text-xs">Mensaje (PT)</Label>
                    <Textarea value={form.message_pt || ""} onChange={(e) => setForm({ ...form, message_pt: e.target.value })} maxLength={500} rows={3} placeholder="Mensagem em português" />
                  </div>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label className="text-xs text-muted-foreground">Redes sociales (opcional)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input value={form.instagram_url || ""} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} placeholder="Instagram URL" maxLength={300} />
                  <Input value={form.facebook_url || ""} onChange={(e) => setForm({ ...form, facebook_url: e.target.value })} placeholder="Facebook URL" maxLength={300} />
                  <Input value={form.linkedin_url || ""} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="LinkedIn URL" maxLength={300} />
                  <Input value={form.twitter_url || ""} onChange={(e) => setForm({ ...form, twitter_url: e.target.value })} placeholder="X / Twitter URL" maxLength={300} />
                  <Input value={form.tiktok_url || ""} onChange={(e) => setForm({ ...form, tiktok_url: e.target.value })} placeholder="TikTok URL" maxLength={300} />
                  <Input value={form.youtube_url || ""} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} placeholder="YouTube URL" maxLength={300} />
                  <Input className="sm:col-span-2" value={form.website_url || ""} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="Sitio web" maxLength={300} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Orden</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                  <Label className="mb-2">Activa</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
