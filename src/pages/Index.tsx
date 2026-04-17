import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Coins, Loader2, Sparkles, Video, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MODELS, submitGeneration, type WSModel } from "@/lib/wavespeed";
import { consumeCredits, fetchCost, getPricingKey, useCredits } from "@/hooks/useCredits";
import { ReferenceImageInput } from "@/components/ReferenceImageInput";

const VIDEO_MODELS = MODELS.filter((m) => m.type === "video");
const IMAGE_MODELS = MODELS.filter((m) => m.type === "image");

function ModelSelect({ value, onChange, models }: { value: string; onChange: (v: string) => void; models: WSModel[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.label} <span className="text-muted-foreground text-xs ml-1">· {m.brand}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function GeneratePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("video");

  // Video
  const [vModelId, setVModelId] = useState(VIDEO_MODELS[0].id);
  const [vPrompt, setVPrompt] = useState("");
  const [vDuration, setVDuration] = useState("5");
  const [vAspect, setVAspect] = useState("16:9");
  const [vNegative, setVNegative] = useState("");
  const [vRefImage, setVRefImage] = useState("");
  const vModel = useMemo(() => VIDEO_MODELS.find((m) => m.id === vModelId)!, [vModelId]);

  // Image
  const [iModelId, setIModelId] = useState(IMAGE_MODELS[0].id);
  const [iPrompt, setIPrompt] = useState("");
  const [iAspect, setIAspect] = useState("1:1");
  const [iNegative, setINegative] = useState("");
  const [iRefImage, setIRefImage] = useState("");
  const iModel = useMemo(() => IMAGE_MODELS.find((m) => m.id === iModelId)!, [iModelId]);

  const handleGenerateVideo = async () => {
    if (!vPrompt.trim()) return;
    setLoading(true);
    try {
      const cost = await fetchCost(getPricingKey({ type: "video", model: vModelId, duration: vDuration, mode: "std" }));
      await consumeCredits(cost, `video:${vModel.label}:${vDuration}s`);
      const res = await submitGeneration({
        type: "video",
        modelId: vModelId,
        prompt: vPrompt,
        aspect_ratio: vAspect,
        duration: parseInt(vDuration),
        negative_prompt: vNegative || undefined,
        image_url: vRefImage || undefined,
      });
      if (res.code === 0) {
        toast({ title: `¡Video en generación! (-${cost} créditos)`, description: "Revisa el historial para ver el progreso." });
      } else {
        toast({ title: "Error", description: res.message || "Error al generar", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!iPrompt.trim()) return;
    setLoading(true);
    try {
      const cost = await fetchCost(getPricingKey({ type: "image", model: iModelId }));
      await consumeCredits(cost, `image:${iModel.label}`);
      const res = await submitGeneration({
        type: "image",
        modelId: iModelId,
        prompt: iPrompt,
        aspect_ratio: iAspect,
        negative_prompt: iNegative || undefined,
        image_url: iRefImage || undefined,
      });
      if (res.code === 0) {
        toast({ title: `¡Imagen en generación! (-${cost} créditos)`, description: "Revisa el historial." });
      } else {
        toast({ title: "Error", description: res.message || "Error al generar", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-4 py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs font-medium text-primary-foreground/90">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Powered by WaveSpeed AI · 700+ modelos
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
          Crea <span className="text-gradient">imágenes</span> y videos cinemáticos con IA
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
          Sora 2, Veo 3.1, Kling 2.5, Seedance, Nano Banana 2 y más en un solo panel.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="video" className="gap-2"><Video className="h-4 w-4" /> Video</TabsTrigger>
          <TabsTrigger value="image" className="gap-2"><ImageIcon className="h-4 w-4" /> Imagen</TabsTrigger>
        </TabsList>

        <TabsContent value="video">
          <Card className="border-border/60 bg-card/80 backdrop-blur shadow-elegant">
            <CardHeader><CardTitle className="text-lg">Generar Video</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Prompt *</Label>
                <Textarea placeholder="Describe el video que quieres generar..." value={vPrompt} onChange={(e) => setVPrompt(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <ModelSelect value={vModelId} onChange={setVModelId} models={VIDEO_MODELS} />
                </div>
                <div className="space-y-2">
                  <Label>Duración</Label>
                  <Select value={vDuration} onValueChange={setVDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(vModel.durations || [5, 10]).map((d) => (
                        <SelectItem key={d} value={String(d)}>{d} segundos</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aspecto</Label>
                  <Select value={vAspect} onValueChange={setVAspect}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(vModel.aspects || ["16:9","9:16","1:1"]).map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input value={vModel.brand} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prompt negativo (opcional)</Label>
                <Input placeholder="Lo que NO quieres en el video..." value={vNegative} onChange={(e) => setVNegative(e.target.value)} />
              </div>
              {vModel.supportsImage && (
                <ReferenceImageInput value={vRefImage} onChange={setVRefImage} />
              )}
              <Button onClick={handleGenerateVideo} disabled={loading || !vPrompt.trim()} className="w-full" size="lg">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generar Video
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image">
          <Card className="border-border/60 bg-card/80 backdrop-blur shadow-elegant">
            <CardHeader><CardTitle className="text-lg">Generar Imagen</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Prompt *</Label>
                <Textarea placeholder="Describe la imagen que quieres generar..." value={iPrompt} onChange={(e) => setIPrompt(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <ModelSelect value={iModelId} onChange={setIModelId} models={IMAGE_MODELS} />
                </div>
                <div className="space-y-2">
                  <Label>Aspecto</Label>
                  <Select value={iAspect} onValueChange={setIAspect}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(iModel.aspects || ["1:1","16:9","9:16"]).map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prompt negativo (opcional)</Label>
                <Input placeholder="Lo que NO quieres en la imagen..." value={iNegative} onChange={(e) => setINegative(e.target.value)} />
              </div>
              {iModel.supportsImage && (
                <ReferenceImageInput value={iRefImage} onChange={setIRefImage} label="Imagen de referencia (opcional, image-to-image)" />
              )}
              <Button onClick={handleGenerateImage} disabled={loading || !iPrompt.trim()} className="w-full" size="lg">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generar Imagen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
