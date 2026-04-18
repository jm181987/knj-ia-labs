import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ReferenceImageInput } from "@/components/ReferenceImageInput";
import { AudioInput } from "@/components/AudioInput";
import { Loader2, Mic, Wand2, UserCircle2, Sparkles, Info } from "lucide-react";
import { MODELS, submitGeneration, pollGeneration, type WSModel } from "@/lib/wavespeed";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

type Mode = "lipsync" | "liveportrait" | "portrait";

const MODE_FILTERS: Record<Mode, (m: WSModel) => boolean> = {
  lipsync: (m) => m.category === "avatar" && !!m.requiresAudio,
  liveportrait: (m) => m.category === "avatar" && !!m.requiresDriverVideo,
  portrait: (m) => m.category === "avatar" && m.type === "image",
};

export default function AvatarsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("lipsync");

  // estado compartido
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [driverVideoUrl, setDriverVideoUrl] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [submitting, setSubmitting] = useState(false);

  const availableModels = MODELS.filter(MODE_FILTERS[mode]);
  const [modelId, setModelId] = useState(availableModels[0]?.id || "");

  const onModeChange = (m: string) => {
    const newMode = m as Mode;
    setMode(newMode);
    const first = MODELS.filter(MODE_FILTERS[newMode])[0];
    setModelId(first?.id || "");
  };

  const model = MODELS.find((m) => m.id === modelId);

  const handleGenerate = async () => {
    if (!model) return;
    if (model.requiresImage && !imageUrl) {
      toast({ title: "Subí una foto del avatar", variant: "destructive" });
      return;
    }
    if (model.requiresAudio && !audioUrl) {
      toast({ title: "Subí el audio para sincronizar", variant: "destructive" });
      return;
    }
    if (model.requiresDriverVideo && !driverVideoUrl) {
      toast({ title: "Subí el video que va a guiar la animación", variant: "destructive" });
      return;
    }
    if (mode === "portrait" && !prompt.trim()) {
      toast({ title: "Describí el retrato", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitGeneration({
        type: model.type,
        modelId: model.id,
        prompt: prompt || `${model.label} avatar`,
        aspect_ratio: aspect,
        image_url: imageUrl || undefined,
        audio_url: audioUrl || undefined,
        driver_video_url: driverVideoUrl || undefined,
      });
      if (res.code !== 0 || !res.data) throw new Error(res.message || "Error al enviar");
      toast({ title: "Avatar en cola", description: "Te avisamos cuando esté listo" });

      // Polling rápido y luego derivamos al historial
      const id = res.data.id;
      let tries = 0;
      const tick = async () => {
        tries++;
        const r: any = await pollGeneration(id);
        const status = r?.data?.status;
        if (status === "completed" || status === "failed" || tries > 60) {
          if (status === "completed") toast({ title: "¡Avatar listo!" });
          if (status === "failed") toast({ title: "Falló", description: r?.data?.error, variant: "destructive" });
          navigate("/app/history");
          return;
        }
        setTimeout(tick, 5000);
      };
      setTimeout(tick, 4000);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <UserCircle2 className="h-7 w-7 text-primary" />
          Avatares IA
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Creá personajes que hablan, animá fotos o generá retratos desde un prompt.
        </p>
      </div>

      <Tabs value={mode} onValueChange={onModeChange}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="lipsync" className="gap-1.5"><Mic className="h-4 w-4" /> Hablar</TabsTrigger>
          <TabsTrigger value="liveportrait" className="gap-1.5"><Wand2 className="h-4 w-4" /> Animar</TabsTrigger>
          <TabsTrigger value="portrait" className="gap-1.5"><Sparkles className="h-4 w-4" /> Retrato</TabsTrigger>
        </TabsList>

        <TabsContent value="lipsync">
          <Card>
            <CardHeader>
              <CardTitle>Avatar parlante (lip-sync)</CardTitle>
              <CardDescription>Subí una foto + un audio y generamos un video con la boca sincronizada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ModelSelect models={availableModels} value={modelId} onChange={setModelId} />
              <ReferenceImageInput value={imageUrl} onChange={setImageUrl} label="Foto del avatar (rostro visible)" />
              <AudioInput value={audioUrl} onChange={setAudioUrl} label="Audio a sincronizar" />
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>¿Necesitás generar la voz?</AlertTitle>
                <AlertDescription>
                  Próximamente vas a poder escribir un texto y generar la voz automáticamente con ElevenLabs.
                  Por ahora, subí un mp3 o wav.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liveportrait">
          <Card>
            <CardHeader>
              <CardTitle>Animar foto (live portrait)</CardTitle>
              <CardDescription>Una foto y un video corto con expresiones — la cara de la foto imita los gestos del video.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ModelSelect models={availableModels} value={modelId} onChange={setModelId} />
              <ReferenceImageInput value={imageUrl} onChange={setImageUrl} label="Foto del rostro" />
              <AudioInput
                value={driverVideoUrl}
                onChange={setDriverVideoUrl}
                label="Video guía (driver)"
                bucket="avatar-videos"
                accept="video/mp4,video/webm,video/quicktime"
                hint="MP4 o WebM corto (5-15s) · máx 50 MB"
                maxMB={50}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portrait">
          <Card>
            <CardHeader>
              <CardTitle>Retrato desde texto</CardTitle>
              <CardDescription>Generá la imagen base de un avatar describiéndolo. Después podés usarla en los otros modos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ModelSelect models={availableModels} value={modelId} onChange={setModelId} />
              <div className="space-y-2">
                <Label>Descripción del avatar</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Mujer 30 años, pelo castaño, sonrisa suave, fondo neutro, iluminación cinematográfica, fotografía de retrato..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select value={aspect} onValueChange={setAspect}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(model?.aspects || ["1:1"]).map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button onClick={handleGenerate} disabled={submitting || !model} size="lg" className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Generar avatar
      </Button>
    </div>
  );
}

function ModelSelect({ models, value, onChange }: { models: WSModel[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Modelo</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.label} <span className="text-muted-foreground text-xs ml-1">({m.brand})</span></SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
