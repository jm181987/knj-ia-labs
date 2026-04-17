import { useEffect, useState } from "react";
import { listGenerations, type Generation } from "@/lib/wavespeed";
import { Loader2, Download, Video, Image } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function GalleryPage() {
  const { t } = useTranslation();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [preview, setPreview] = useState<{ url: string; type: "video" | "image" } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await listGenerations({ status: "completed" });
        setGenerations(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = tab === "all" ? generations : generations.filter((g) => g.type === tab);

  const allItems = filtered.flatMap((gen) =>
    gen.result_urls.map((url, i) => ({
      url,
      type: gen.type,
      prompt: gen.prompt,
      key: `${gen.id}-${i}`,
    }))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("gallery.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t("gallery.subtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
          <TabsTrigger value="video" className="gap-1"><Video className="h-3 w-3" /> {t("gallery.videos")}</TabsTrigger>
          <TabsTrigger value="image" className="gap-1"><Image className="h-3 w-3" /> {t("gallery.images")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : allItems.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">{t("gallery.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {allItems.map((item) => (
            <div
              key={item.key}
              className="group relative aspect-video rounded-xl overflow-hidden bg-muted cursor-pointer border hover:ring-2 hover:ring-primary transition-all"
              onClick={() => setPreview({ url: item.url, type: item.type })}
            >
              {item.type === "video" ? (
                <video src={item.url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <p className="text-xs text-white line-clamp-2">{item.prompt}</p>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={item.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button size="icon" variant="secondary" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-4xl p-2">
          {preview?.type === "video" ? (
            <video src={preview.url} controls autoPlay className="w-full rounded-lg" />
          ) : preview ? (
            <img src={preview.url} alt="" className="w-full rounded-lg" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
