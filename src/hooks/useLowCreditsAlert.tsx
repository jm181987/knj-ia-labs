import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import { useCredits } from "./useCredits";
import { useAdmin } from "./useAdmin";

const DEFAULT_THRESHOLD = 10;
const SESSION_KEY_PREFIX = "lowCreditsAlertShown:";

/**
 * Muestra un toast cuando el saldo del usuario baja del umbral configurado.
 * - Solo dispara una vez por sesión y por usuario (sessionStorage).
 * - No molesta si el usuario ya está en /pricing.
 * - El umbral se puede configurar en app_settings (key: low_credits_threshold).
 */
export function useLowCreditsAlert() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { balance, loading } = useCredits();
  const navigate = useNavigate();
  const location = useLocation();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!user || loading || balance === null) return;
    if (isAdmin) return; // Los admins no necesitan alerta de créditos
    if (location.pathname.startsWith("/pricing")) return;
    if (firedRef.current) return;

    const sessionKey = `${SESSION_KEY_PREFIX}${user.id}`;
    if (sessionStorage.getItem(sessionKey)) return;

    // Cargar umbral desde app_settings (best-effort; usa default si falla)
    const showAlertIfNeeded = (threshold: number) => {
      if (balance > 0 && balance < threshold) {
        firedRef.current = true;
        sessionStorage.setItem(sessionKey, "1");
        toast.warning(`Te quedan ${balance} créditos`, {
          description: "Recargá tu cuenta para seguir generando sin interrupciones.",
          duration: 10000,
          action: {
            label: "Recargar",
            onClick: () => navigate("/pricing"),
          },
        });
      } else if (balance === 0) {
        firedRef.current = true;
        sessionStorage.setItem(sessionKey, "1");
        toast.error("Te quedaste sin créditos", {
          description: "Comprá un paquete para seguir creando.",
          duration: 12000,
          action: {
            label: "Ver paquetes",
            onClick: () => navigate("/pricing"),
          },
        });
      }
    };

    import("@/integrations/supabase/client").then(({ supabase }) => {
      (supabase as any)
        .from("app_settings")
        .select("value")
        .eq("key", "low_credits_threshold")
        .maybeSingle()
        .then(({ data }: { data: { value: unknown } | null }) => {
          const raw = data?.value;
          const parsed = typeof raw === "number" ? raw : Number(raw);
          const threshold = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_THRESHOLD;
          showAlertIfNeeded(threshold);
        });
    });
  }, [user, balance, loading, location.pathname, navigate]);
}
