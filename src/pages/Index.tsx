import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Video, Image, Info, Wand2, ScanEye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateVideo, generateImage } from "@/lib/kling";
import { generateImageAI, improvePrompt, describeImage } from "@/lib/lovableAi";

// Unified model list — provider determines routing
const VIDEO_MODELS = [
  { value: "kling-v1", label: "Kling v1", provider: "kling" },
  { value: "kling-v1-5", label: "Kling v1.5", provider: "kling" },
  { value: "kling-v1-6", label: "Kling v1.6", provider: "kling" },
];
const IMAGE_MODELS = [
  { value: "kling-v1", label: "Kling v1", provider: "kling" },
  { value: "kling-v1-5", label: "Kling v1.5", provider: "kling" },
  { value: "google/gemini-2.5-flash-image", label: "Nano Banana (Gemini)", provider: "lovable" },
  { value: "google/gemini-3.1-flash-image-preview", label: "Nano Banana 2 (Gemini)", provider: "lovable" },
  { value: "google/gemini-3-pro-image-preview", label: "Nano Banana Pro (Gemini)", provider: "lovable" },
];
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function getErrorMessage(code: number, message?: string): string {
  const errorMap: Record<number, string> = {
    1102: "Saldo insuficiente en tu cuenta de Kling API. Los créditos de la web de Kling y los de la API son independientes. Necesitas comprar un paquete de API en klingai.com → API → Billing.",
    1101: "Parámetros inválidos. Revisa tu prompt y opciones.",
    1001: "Error de autenticación. Verifica tus claves de API.",
  };
  return errorMap[code] || message || "Error desconocido al generar";
}

export default function GeneratePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("video");

  // Video params
  const [vPrompt, setVPrompt] = useState("");
  const [vModel, setVModel] = useState("kling-v1");
  const [vDuration, setVDuration] = useState("5");
  const [vAspect, setVAspect] = useState("16:9");
  const [vMode, setVMode] = useState("std");
  const [vNegative, setVNegative] = useState("");
  const [vRefImage, setVRefImage] = useState("");

  // Image params
  const [iPrompt, setIPrompt] = useState("");
  const [iModel, setIModel] = useState("kling-v1");
  const [iAspect, setIAspect] = useState("16:9");
  const [iCount, setICount] = useState("1");
  const [iNegative, setINegative] = useState("");

  const handleGenerateVideo = async () => {
    if (!vPrompt.trim()) return;
    setLoading(true);
    try {
      const res = await generateVideo({
        prompt: vPrompt,
        model: vModel,
        duration: vDuration,
        aspect_ratio: vAspect,
        mode: vMode,
        negative_prompt: vNegative || undefined,
        reference_image_url: vRefImage || undefined,
      });
      if (res.code === 0) {
        toast({ title: "¡Video en generación!", description: "Revisa el historial para ver el progreso." });
      } else {
        toast({ title: "Error", description: getErrorMessage(res.code, res.message), variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!iPrompt.trim()) return;
    setLoading(true);
    try {
      const provider = IMAGE_MODELS.find((m) => m.value === iModel)?.provider;
      let res: { code: number; message?: string };
      if (provider === "lovable") {
        res = await generateImageAI({
          prompt: iPrompt,
          model: iModel,
          aspect_ratio: iAspect,
          image_count: parseInt(iCount),
        });
        if (res.code === 0) {
          toast({ title: "¡Imagen lista!", description: "Mira la galería o el historial." });
        } else {
          toast({ title: "Error", description: res.message || "Error al generar", variant: "destructive" });
        }
      } else {
        res = await generateImage({
          prompt: iPrompt,
          model: iModel,
          aspect_ratio: iAspect,
          image_count: parseInt(iCount),
          negative_prompt: iNegative || undefined,
        });
        if (res.code === 0) {
          toast({ title: "¡Imagen en generación!", description: "Revisa el historial para ver el progreso." });
        } else {
          toast({ title: "Error", description: getErrorMessage(res.code, res.message), variant: "destructive" });
        }
      }
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const [improving, setImproving] = useState(false);
  const handleImprove = async (type: "video" | "image") => {
    const current = type === "video" ? vPrompt : iPrompt;
    if (!current.trim()) return;
    setImproving(true);
    try {
      const improved = await improvePrompt(current, type);
      if (type === "video") setVPrompt(improved);
      else setIPrompt(improved);
      toast({ title: "Prompt mejorado ✨" });
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setImproving(false);
    }
  };

  const [describing, setDescribing] = useState(false);
  const handleDescribe = async () => {
    if (!vRefImage.trim()) {
      toast({ title: "Añade primero la URL de la imagen de referencia", variant: "destructive" });
      return;
    }
    setDescribing(true);
    try {
      const desc = await describeImage(vRefImage);
      if (desc) {
        setVPrompt(desc);
        toast({ title: "Descripción generada ✨" });
      }
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setDescribing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-4 py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs font-medium text-primary-foreground/90">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Modelos avanzados de IA en un solo lugar
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
          Crea <span className="text-gradient">imágenes realistas</span> y videos cinemáticos con IA
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
          Un único panel para generar video e imagen con los mejores modelos de Kling. Simple, rápido y sin complicaciones.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="video" className="gap-2">
            <Video className="h-4 w-4" /> Video
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-2">
            <Image className="h-4 w-4" /> Imagen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="video">
          <Card className="border-border/60 bg-card/80 backdrop-blur shadow-elegant">
            <CardHeader>
              <CardTitle className="text-lg">Generar Video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Prompt *</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleImprove("video")} disabled={improving || !vPrompt.trim()} className="h-7 gap-1.5 text-xs">
                    {improving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    Mejorar con IA
                  </Button>
                </div>
                <Textarea
                  placeholder="Describe el video que quieres generar..."
                  value={vPrompt}
                  onChange={(e) => setVPrompt(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Select value={vModel} onValueChange={setVModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VIDEO_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duración</Label>
                  <Select value={vDuration} onValueChange={setVDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 segundos</SelectItem>
                      <SelectItem value="10">10 segundos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aspecto</Label>
                  <Select value={vAspect} onValueChange={setVAspect}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9</SelectItem>
                      <SelectItem value="9:16">9:16</SelectItem>
                      <SelectItem value="1:1">1:1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Modo</Label>
                  <Select value={vMode} onValueChange={setVMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="std">Estándar</SelectItem>
                      <SelectItem value="pro">Profesional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prompt negativo (opcional)</Label>
                <Input
                  placeholder="Lo que NO quieres en el video..."
                  value={vNegative}
                  onChange={(e) => setVNegative(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>URL imagen de referencia (opcional)</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={handleDescribe} disabled={describing || !vRefImage.trim()} className="h-7 gap-1.5 text-xs">
                    {describing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanEye className="h-3 w-3" />}
                    Describir imagen
                  </Button>
                </div>
                <Input
                  placeholder="https://..."
                  value={vRefImage}
                  onChange={(e) => setVRefImage(e.target.value)}
                />
              </div>
              <Button
                onClick={handleGenerateVideo}
                disabled={loading || !vPrompt.trim()}
                className="w-full"
                size="lg"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generar Video
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image">
          <Card className="border-border/60 bg-card/80 backdrop-blur shadow-elegant">
            <CardHeader>
              <CardTitle className="text-lg">Generar Imagen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Prompt *</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleImprove("image")} disabled={improving || !iPrompt.trim()} className="h-7 gap-1.5 text-xs">
                    {improving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    Mejorar con IA
                  </Button>
                </div>
                <Textarea
                  placeholder="Describe la imagen que quieres generar..."
                  value={iPrompt}
                  onChange={(e) => setIPrompt(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Select value={iModel} onValueChange={setIModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IMAGE_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aspecto</Label>
                  <Select value={iAspect} onValueChange={setIAspect}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9</SelectItem>
                      <SelectItem value="9:16">9:16</SelectItem>
                      <SelectItem value="1:1">1:1</SelectItem>
                      <SelectItem value="2:3">2:3</SelectItem>
                      <SelectItem value="3:2">3:2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Select value={iCount} onValueChange={setICount}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prompt negativo (opcional)</Label>
                <Input
                  placeholder="Lo que NO quieres en la imagen..."
                  value={iNegative}
                  onChange={(e) => setINegative(e.target.value)}
                />
              </div>
              <Button
                onClick={handleGenerateImage}
                disabled={loading || !iPrompt.trim()}
                className="w-full"
                size="lg"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generar Imagen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
            <Info className="h-4 w-4" />
            Ver tabla de costos por generación
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Costos en créditos Kling</CardTitle>
            </CardHeader>
            <CardContent>
              <h4 className="font-medium text-sm mb-2">Video</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead className="text-right">Créditos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell>Kling v1</TableCell><TableCell>5s</TableCell><TableCell>Estándar</TableCell><TableCell className="text-right">10</TableCell></TableRow>
                  <TableRow><TableCell>Kling v1</TableCell><TableCell>10s</TableCell><TableCell>Estándar</TableCell><TableCell className="text-right">20</TableCell></TableRow>
                  <TableRow><TableCell>Kling v1</TableCell><TableCell>5s</TableCell><TableCell>Pro</TableCell><TableCell className="text-right">35</TableCell></TableRow>
                  <TableRow><TableCell>Kling v1</TableCell><TableCell>10s</TableCell><TableCell>Pro</TableCell><TableCell className="text-right">70</TableCell></TableRow>
                  <TableRow><TableCell>Kling v1.5</TableCell><TableCell>5s</TableCell><TableCell>Estándar</TableCell><TableCell className="text-right">10</TableCell></TableRow>
                  <TableRow><TableCell>Kling v1.5</TableCell><TableCell>10s</TableCell><TableCell>Estándar</TableCell><TableCell className="text-right">20</TableCell></TableRow>
                  <TableRow><TableCell>Kling v1.6</TableCell><TableCell>5s</TableCell><TableCell>Estándar</TableCell><TableCell className="text-right">10</TableCell></TableRow>
                  <TableRow><TableCell>Kling v1.6</TableCell><TableCell>10s</TableCell><TableCell>Estándar</TableCell><TableCell className="text-right">20</TableCell></TableRow>
                </TableBody>
              </Table>

              <h4 className="font-medium text-sm mt-4 mb-2">Imagen</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead className="text-right">Créditos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell>Kling v1</TableCell><TableCell>1 imagen</TableCell><TableCell className="text-right">1</TableCell></TableRow>
                  <TableRow><TableCell>Kling v1</TableCell><TableCell>4 imágenes</TableCell><TableCell className="text-right">4</TableCell></TableRow>
                  <TableRow><TableCell>Kling v1.5</TableCell><TableCell>1 imagen</TableCell><TableCell className="text-right">1</TableCell></TableRow>
                  <TableRow><TableCell>Kling v1.5</TableCell><TableCell>4 imágenes</TableCell><TableCell className="text-right">4</TableCell></TableRow>
                </TableBody>
              </Table>

              <p className="text-xs text-muted-foreground mt-3">
                * Los costos son aproximados y pueden variar. Consulta{" "}
                <a href="https://klingai.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                  klingai.com
                </a>{" "}
                para precios actualizados y tu saldo.
              </p>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
