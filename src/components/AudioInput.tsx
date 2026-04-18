import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Link as LinkIcon, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Props = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  bucket?: "avatar-audio" | "avatar-videos";
  accept?: string;
  hint?: string;
  maxMB?: number;
};

export function AudioInput({
  value,
  onChange,
  label = "Audio",
  bucket = "avatar-audio",
  accept = "audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/webm",
  hint = "MP3, WAV o M4A · máx 25 MB",
  maxMB = 25,
}: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > maxMB * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: `Máximo ${maxMB} MB`, variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Necesitas iniciar sesión");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast({ title: "Archivo subido" });
    } catch (e) {
      toast({ title: "Error al subir", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const isAudio = bucket === "avatar-audio";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {value ? (
        <div className="flex items-start gap-3 p-3 rounded-md border border-border/60 bg-muted/30">
          <div className="h-12 w-12 rounded-md border border-border/60 bg-muted flex items-center justify-center shrink-0">
            <Music className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            {isAudio ? (
              <audio src={value} controls className="w-full h-9" />
            ) : (
              <video src={value} controls className="w-full max-h-48 rounded" />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange("")}
            >
              <X className="h-3 w-3 mr-1" /> Quitar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Subir desde el dispositivo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-2">
            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              placeholder="...o pega una URL pública (https://...)"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      )}
    </div>
  );
}
