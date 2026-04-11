import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, variant: "secondary" as const },
  processing: { label: "Procesando", icon: Loader2, variant: "default" as const },
  completed: { label: "Completado", icon: CheckCircle2, variant: "outline" as const },
  failed: { label: "Error", icon: XCircle, variant: "destructive" as const },
};

export function StatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}
