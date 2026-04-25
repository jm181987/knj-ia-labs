import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

let cachedClientId: string | null = null;
async function getClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  const { data, error } = await supabase.functions.invoke("paypal-config", { body: {} });
  if (error) throw new Error(error.message);
  const id = (data as any)?.client_id;
  if (!id) throw new Error("PAYPAL_CLIENT_ID no configurado en el backend");
  cachedClientId = id;
  return id;
}

let sdkPromise: Promise<any> | null = null;
async function loadPaypalSdk(opts: { intent: "capture" | "subscription"; vault?: boolean }) {
  if (typeof window === "undefined") return Promise.resolve(null);
  const clientId = await getClientId();
  if ((window as any).paypal && (window as any).__paypalSdkConfig === JSON.stringify(opts)) {
    return Promise.resolve((window as any).paypal);
  }
  document.querySelectorAll("script[data-paypal-sdk]").forEach((s) => s.remove());
  delete (window as any).paypal;

  sdkPromise = new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      "client-id": clientId,
      currency: "USD",
      intent: opts.intent,
    });
    if (opts.vault) params.set("vault", "true");
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    s.dataset.paypalSdk = "true";
    s.onload = () => {
      (window as any).__paypalSdkConfig = JSON.stringify(opts);
      resolve((window as any).paypal);
    };
    s.onerror = () => reject(new Error("PayPal SDK falló al cargar"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

interface OneTimeProps {
  mode: "order";
  packageId?: string;
  customAmountUsd?: number;
  disabled?: boolean;
  onSuccess?: (credits: number) => void;
}

interface SubProps {
  mode: "subscription";
  disabled?: boolean;
  onSuccess?: () => void;
}

type Props = OneTimeProps | SubProps;

export function PayPalButton(props: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isSub = props.mode === "subscription";

    loadPaypalSdk({ intent: isSub ? "subscription" : "capture", vault: isSub })
      .then((paypal) => {
        if (cancelled || !paypal || !ref.current) return;
        ref.current.innerHTML = "";

        const requireAuth = () => {
          if (!user) {
            navigate("/auth");
            return false;
          }
          return true;
        };

        const buttonsCfg: any = {
          style: { layout: "horizontal", color: "blue", shape: "rect", label: isSub ? "subscribe" : "paypal", height: 44, tagline: false },
          onError: (e: any) => {
            console.error("PayPal error:", e);
            toast({ title: "Error de PayPal", description: String(e?.message || e), variant: "destructive" });
          },
        };

        if (isSub) {
          buttonsCfg.createSubscription = async () => {
            if (!requireAuth()) throw new Error("Debes iniciar sesión");
            const { data, error } = await supabase.functions.invoke("paypal-create-subscription", {
              body: { return_origin: window.location.origin },
            });
            if (error) throw error;
            const subId = (data as any)?.subscription_id;
            if (!subId) throw new Error((data as any)?.error || "No se pudo crear la suscripción");
            return subId;
          };
          buttonsCfg.onApprove = async () => {
            toast({ title: "Suscripción aprobada", description: "Los créditos se acreditarán automáticamente." });
            (props as SubProps).onSuccess?.();
          };
        } else {
          buttonsCfg.createOrder = async () => {
            if (!requireAuth()) throw new Error("Debes iniciar sesión");
            const p = props as OneTimeProps;
            const { data, error } = await supabase.functions.invoke("paypal-create-order", {
              body: p.packageId
                ? { package_id: p.packageId }
                : { custom_amount_usd: p.customAmountUsd },
            });
            if (error) throw error;
            const id = (data as any)?.id;
            if (!id) throw new Error((data as any)?.error || "No se pudo crear la orden");
            return id;
          };
          buttonsCfg.onApprove = async (data: any) => {
            const { data: cap, error } = await supabase.functions.invoke("paypal-capture-order", {
              body: { paypal_order_id: data.orderID },
            });
            if (error) {
              toast({ title: "Error capturando pago", description: error.message, variant: "destructive" });
              return;
            }
            const credits = (cap as any)?.credits;
            toast({ title: "¡Pago aprobado!", description: `Se acreditaron ${credits} créditos.` });
            (props as OneTimeProps).onSuccess?.(credits);
          };
        }

        try {
          paypal.Buttons(buttonsCfg).render(ref.current);
        } catch (e) {
          console.error("Render PayPal buttons:", e);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, (props as any).packageId, (props as any).customAmountUsd, (props as any).disabled, user]);

  if (err) {
    return <p className="text-xs text-destructive">{err}</p>;
  }

  return (
    <div className="relative min-h-[44px]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={ref} className={props.disabled ? "opacity-50 pointer-events-none" : ""} />
    </div>
  );
}