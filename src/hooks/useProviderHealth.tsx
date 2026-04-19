import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProviderHealth = {
  healthy: boolean;
  checked_at: string | null;
  latency_ms: number | null;
};

export function useProviderHealth() {
  const [health, setHealth] = useState<ProviderHealth | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "provider_health")
        .maybeSingle();
      if (cancelled || !data?.value) return;
      setHealth(data.value as unknown as ProviderHealth);
    };

    load();
    const id = setInterval(load, 60_000); // refrescar cada minuto

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return health;
}
