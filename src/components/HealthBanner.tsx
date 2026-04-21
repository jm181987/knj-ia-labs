import { AlertTriangle } from "lucide-react";
import { useProviderHealth } from "@/hooks/useProviderHealth";

export function HealthBanner() {
  const health = useProviderHealth();
  if (!health || health.healthy) return null;
  // Si el último check es viejo (>15 min), no mostramos el banner: probablemente
  // el cron no corrió y no queremos asustar al usuario con un estado obsoleto.
  if (health.checked_at) {
    const ageMs = Date.now() - new Date(health.checked_at).getTime();
    if (ageMs > 15 * 60 * 1000) return null;
  }

  return (
    <div className="bg-destructive/15 border-b border-destructive/30 text-destructive-foreground py-2 px-4 text-center text-xs sm:text-sm font-medium">
      <AlertTriangle className="inline h-4 w-4 mr-1.5 -mt-0.5 text-destructive" />
      <span className="text-foreground">El sistema no responde, intentá en unos minutos.</span>
    </div>
  );
}
