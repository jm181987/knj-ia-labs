import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Props = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/png,image/jpeg,image/webp";

function normalizePublicUrl(url: string): string {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(https?:\/\/|data:)/i.test(value)) return value;
  if (value.startsWith("/") && typeof window !== "undefined") {
    return new URL(value, window.location.origin).toString();
  }
  return value;
}

export function ReferenceImageInput({ value, onChange, label = "Imagen de referencia (opcional)" }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast({ title: "Formato no soportado", description: "Usa PNG, JPG o WebP", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "Imagen muy grande", description: "Máximo 10 MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Necesitas iniciar sesión");
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("reference-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("reference-images").getPublicUrl(path);
      onChange(normalizePublicUrl(data.publicUrl));
      toast({ title: "Imagen subida" });
    } catch (e) {
      toast({ title: "Error al subir", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {value ? (
        <div className="flex items-start gap-3 p-3 rounded-md border border-border/60 bg-muted/30">
          <img src={value} alt="referencia" className="h-20 w-20 object-cover rounded-md border border-border/60" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{value}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs"
              onClick={() => onChange("")}
            >
              <X className="h-3 w-3 mr-1" /> Quitar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Subir desde el dispositivo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              placeholder="...o pega una URL pública (https://...)"
              value={value}
              onChange={(e) => onChange(normalizePublicUrl(e.target.value))}
              className="text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG o WebP · máx 10 MB</p>
        </div>
      )}
    </div>
  );
}
