import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { listGenerations, checkVideoStatus, checkImageStatus, type Generation } from "@/lib/kling";
import { Loader2, Video, Image, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchGenerations = useCallback(async () => {
    try {
      const data = await listGenerations({
        type: typeFilter !== "all" ? typeFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setGenerations(data);
    } catch (e) {
      console.error("Failed to fetch generations:", e);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  // Poll processing tasks
  useEffect(() => {
    const processing = generations.filter((g) => g.status === "processing");
    if (processing.length === 0) return;

    const interval = setInterval(async () => {
      for (const gen of processing) {
        if (!gen.task_id) continue;
        if (gen.type === "video") {
          await checkVideoStatus(gen.task_id);
        } else {
          await checkImageStatus(gen.task_id);
        }
      }
      fetchGenerations();
    }, 10000);

    return () => clearInterval(interval);
  }, [generations, fetchGenerations]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Historial</h1>
          <p className="text-muted-foreground mt-1">Todas tus generaciones</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchGenerations(); }}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Imagen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="processing">Procesando</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="failed">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : generations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No hay generaciones aún</p>
          <p className="text-sm mt-1">Ve a "Generar" para crear tu primer contenido</p>
        </div>
      ) : (
        <div className="space-y-3">
          {generations.map((gen) => (
            <Card key={gen.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-accent">
                    {gen.type === "video" ? (
                      <Video className="h-5 w-5 text-accent-foreground" />
                    ) : (
                      <Image className="h-5 w-5 text-accent-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={gen.status} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(gen.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm truncate">{gen.prompt}</p>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      {gen.model && <span>Modelo: {gen.model}</span>}
                      {gen.aspect_ratio && <span>• {gen.aspect_ratio}</span>}
                      {gen.type === "video" && gen.duration && <span>• {gen.duration}s</span>}
                    </div>
                    {gen.status === "completed" && gen.result_urls.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {gen.result_urls.map((url, i) => (
                          gen.type === "video" ? (
                            <video key={i} src={url} controls className="h-24 rounded-md" />
                          ) : (
                            <img key={i} src={url} alt="" className="h-24 rounded-md object-cover" />
                          )
                        ))}
                      </div>
                    )}
                    {gen.status === "failed" && gen.error_message && (
                      <p className="text-xs text-destructive mt-1">{gen.error_message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
