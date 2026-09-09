import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useCredits() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (mounted) {
        setBalance(data?.balance ?? 0);
        setLoading(false);
      }
    };

    void load();
    const interval = window.setInterval(() => { void load(); }, 5000);
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user]);

  return { balance, loading };
}

export function getPricingKey(params: {
  type: "image" | "video";
  model: string;
  duration?: string;
  mode?: string;
}): string {
  if (params.type === "image") return `image_${params.model}`;
  return `video_${params.model}_${params.duration ?? "5"}_${params.mode ?? "std"}`;
}

export async function fetchCost(key: string): Promise<number> {
  const { data, error } = await (supabase as any)
    .from("pricing")
    .select("credits")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) throw new Error(`No se encontró el costo para "${key}". Contacta al admin.`);
  return data.credits as number;
}

export async function consumeCredits(amount: number, reason: string, generationId?: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc("consume_credits", {
    _amount: amount,
    _reason: reason,
    _generation_id: generationId ?? null,
  });
  if (error) {
    if (error.message?.includes("insufficient_credits")) {
      throw new Error("Saldo insuficiente. Contacta al administrador para recargar tu cuenta.");
    }
    throw new Error(error.message);
  }
  return data as number;
}
