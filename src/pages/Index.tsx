import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Video, Image, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateVideo, generateImage } from "@/lib/kling";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
        toast({ title: "Error", description: res.message || "Error al generar", variant: "destructive" });
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
      const res = await generateImage({
        prompt: iPrompt,
        model: iModel,
        aspect_ratio: iAspect,
        image_count: parseInt(iCount),
        negative_prompt: iNegative || undefined,
      });
      if (res.code === 0) {
        toast({ title: "¡Imagen en generación!", description: "Revisa el historial para ver el progreso." });
      } else {
        toast({ title: "Error", description: res.message || "Error al generar", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generar contenido</h1>
        <p className="text-muted-foreground mt-1">Crea videos e imágenes con inteligencia artificial</p>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generar Video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Prompt *</Label>
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
                      <SelectItem value="kling-v1">Kling v1</SelectItem>
                      <SelectItem value="kling-v1-5">Kling v1.5</SelectItem>
                      <SelectItem value="kling-v1-6">Kling v1.6</SelectItem>
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
                <Label>URL imagen de referencia (opcional)</Label>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generar Imagen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Prompt *</Label>
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
                      <SelectItem value="kling-v1">Kling v1</SelectItem>
                      <SelectItem value="kling-v1-5">Kling v1.5</SelectItem>
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
