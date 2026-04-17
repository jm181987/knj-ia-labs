import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

function CostBadge({ cost, balance }: { cost: number | null; balance: number | null }) {
  const { t } = useTranslation();
  if (cost === null) {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" /> {t("generate.costLoading")}
      </Badge>
    );
  }
  const insufficient = balance !== null && balance < cost;
  return (
    <Badge
      variant={insufficient ? "destructive" : "secondary"}
      className="gap-1.5 font-mono"
      title={insufficient ? t("generate.insufficient") : `${t("generate.yourBalance")}: ${balance ?? "—"} ${t("common.credits")}`}
    >
      {insufficient ? <AlertCircle className="h-3 w-3" /> : <Coins className="h-3 w-3" />}
      {cost} {cost === 1 ? t("common.credit") : t("common.credits")}
    </Badge>
  );
}

export default function GeneratePage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { balance } = useCredits();
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

  // Costos dinámicos por modelo + parámetros
  const [vCost, setVCost] = useState<number | null>(null);
  const [iCost, setICost] = useState<number | null>(null);

  useEffect(() => {
    let cancel = false;
    setVCost(null);
    fetchCost(getPricingKey({ type: "video", model: vModelId, duration: vDuration, mode: "std" }))
      .then((c) => !cancel && setVCost(c))
      .catch(() => !cancel && setVCost(null));
    return () => { cancel = true; };
  }, [vModelId, vDuration]);

  useEffect(() => {
    let cancel = false;
    setICost(null);
    fetchCost(getPricingKey({ type: "image", model: iModelId }))
      .then((c) => !cancel && setICost(c))
      .catch(() => !cancel && setICost(null));
    return () => { cancel = true; };
  }, [iModelId]);

  // Ajusta duración si el modelo no la soporta
  useEffect(() => {
    const allowed = (vModel.durations || [5, 10]).map(String);
    if (!allowed.includes(vDuration)) setVDuration(allowed[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vModelId]);

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
        toast({ title: `${t("generate.videoQueued")} (-${cost} ${t("common.credits")})`, description: t("generate.checkHistory") });
      } else {
        toast({ title: t("common.error"), description: res.message || t("common.error"), variant: "destructive" });
      }
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
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
        toast({ title: `${t("generate.imageQueued")} (-${cost} ${t("common.credits")})`, description: t("generate.checkHistory") });
      } else {
        toast({ title: t("common.error"), description: res.message || t("common.error"), variant: "destructive" });
      }
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-4 py-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs font-medium text-primary-foreground/90">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t("generate.heroBadge")}
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
          {t("generate.heroTitle1")} <span className="text-gradient">{t("generate.heroTitleHighlight")}</span> {t("generate.heroTitle2")}
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
          {t("generate.heroSub")}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="video" className="gap-2"><Video className="h-4 w-4" /> {t("generate.tabVideo")}</TabsTrigger>
          <TabsTrigger value="image" className="gap-2"><ImageIcon className="h-4 w-4" /> {t("generate.tabImage")}</TabsTrigger>
        </TabsList>

        <TabsContent value="video">
          <Card className="border-border/60 bg-card/80 backdrop-blur shadow-elegant">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-lg">{t("generate.videoTitle")}</CardTitle>
              <CostBadge cost={vCost} balance={balance} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("generate.prompt")}</Label>
                <Textarea placeholder={t("generate.promptVideoPh")} value={vPrompt} onChange={(e) => setVPrompt(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("generate.model")}</Label>
                  <ModelSelect value={vModelId} onChange={setVModelId} models={VIDEO_MODELS} />
                </div>
                <div className="space-y-2">
                  <Label>{t("generate.duration")}</Label>
                  <Select value={vDuration} onValueChange={setVDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(vModel.durations || [5, 10]).map((d) => (
                        <SelectItem key={d} value={String(d)}>{d} {t("generate.seconds")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("generate.aspect")}</Label>
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
                  <Label>{t("generate.brand")}</Label>
                  <Input value={vModel.brand} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("generate.negative")}</Label>
                <Input placeholder={t("generate.negativeVideoPh")} value={vNegative} onChange={(e) => setVNegative(e.target.value)} />
              </div>
              {vModel.supportsImage && (
                <ReferenceImageInput value={vRefImage} onChange={setVRefImage} />
              )}
              <Button onClick={handleGenerateVideo} disabled={loading || !vPrompt.trim() || vCost === null || (balance !== null && balance < vCost)} className="w-full" size="lg">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {t("generate.btnVideo")} {vCost !== null && <span className="ml-2 opacity-80 text-xs">· {vCost} {t("common.credits")}</span>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image">
          <Card className="border-border/60 bg-card/80 backdrop-blur shadow-elegant">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-lg">{t("generate.imageTitle")}</CardTitle>
              <CostBadge cost={iCost} balance={balance} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("generate.prompt")}</Label>
                <Textarea placeholder={t("generate.promptImagePh")} value={iPrompt} onChange={(e) => setIPrompt(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("generate.model")}</Label>
                  <ModelSelect value={iModelId} onChange={setIModelId} models={IMAGE_MODELS} />
                </div>
                <div className="space-y-2">
                  <Label>{t("generate.aspect")}</Label>
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
                <Label>{t("generate.negative")}</Label>
                <Input placeholder={t("generate.negativeImagePh")} value={iNegative} onChange={(e) => setINegative(e.target.value)} />
              </div>
              {iModel.supportsImage && (
                <ReferenceImageInput value={iRefImage} onChange={setIRefImage} />
              )}
              <Button onClick={handleGenerateImage} disabled={loading || !iPrompt.trim() || iCost === null || (balance !== null && balance < iCost)} className="w-full" size="lg">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {t("generate.btnImage")} {iCost !== null && <span className="ml-2 opacity-80 text-xs">· {iCost} {t("common.credits")}</span>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
