import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { trackMetaEvent } from "@/lib/metaPixel";

// PayPal Fraudnet: genera un Client Metadata ID (CMID) por sesión y carga
// el script de fingerprint de PayPal. Ese CMID luego viaja al backend y se
// reenvía como header `PayPal-Client-Metadata-Id` en las llamadas a la API
// de PayPal, lo que reduce marcaciones por riesgo/fraude.
let cachedCmid: string | null = null;
function getCmid(): string {
  if (cachedCmid) return cachedCmid;
  const rnd = (globalThis.crypto as any)?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  cachedCmid = `knjpro-${rnd}`.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 32);
  return cachedCmid;
}

let fraudnetLoaded = false;
function ensureFraudnet(sourceIdentifier: string) {
  if (typeof document === "undefined" || fraudnetLoaded) return;
  const cmid = getCmid();
  const cfg = document.createElement("script");
  cfg.type = "application/json";
  cfg.setAttribute("fncls", "fnparams-dede7cc5-15fd-4c75-a9f4-36c430ee3a99");
  cfg.text = JSON.stringify({ f: cmid, s: sourceIdentifier, sandbox: false });
  document.head.appendChild(cfg);
  const s = document.createElement("script");
  s.src = "https://c.paypal.com/da/r/fb.js";
  s.async = true;
  document.head.appendChild(s);
  fraudnetLoaded = true;
}

let cachedClientId: string | null = null;
let clientIdPromise: Promise<string> | null = null;
async function getClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  if (clientIdPromise) return clientIdPromise;
  clientIdPromise = (async () => {
    const { data, error } = await supabase.functions.invoke("paypal-config", { body: {} });
    if (error) throw new Error(error.message);
    const id = (data as any)?.client_id;
    if (!id) throw new Error("PAYPAL_CLIENT_ID no configurado en el backend");
    cachedClientId = id;
    return id;
  })();
  try {
    return await clientIdPromise;
  } finally {
    clientIdPromise = null;
  }
}

// Cargamos múltiples SDKs en paralelo usando data-namespace distintos para que
// puedan coexistir botones de "capture" (compras únicas) y "subscription"
// (suscripciones con vault) en la misma página sin pisarse.
const sdkPromises = new Map<string, Promise<any>>();

function namespaceFor(opts: { intent: "capture" | "subscription"; vault?: boolean }) {
  return opts.intent === "subscription" ? "paypal_sub" : "paypal_cap";
}

async function loadPaypalSdk(opts: { intent: "capture" | "subscription"; vault?: boolean }) {
  if (typeof window === "undefined") return null;
  const ns = namespaceFor(opts);
  const key = ns;

  const existing = (window as any)[ns];
  if (existing) return existing;
  if (sdkPromises.has(key)) return sdkPromises.get(key)!;

  const promise = (async () => {
    const clientId = await getClientId();
    if ((window as any)[ns]) return (window as any)[ns];

    return await new Promise<any>((resolve, reject) => {
      const params = new URLSearchParams({
        "client-id": clientId,
        currency: "USD",
        intent: opts.intent,
      });
      if (opts.vault) params.set("vault", "true");
      const s = document.createElement("script");
      s.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
      s.async = true;
      s.dataset.paypalSdk = ns;
      s.setAttribute("data-namespace", ns);
      s.onload = () => {
        const sdk = (window as any)[ns];
        if (!sdk) {
          reject(new Error("PayPal SDK no expuso namespace " + ns));
          return;
        }
        resolve(sdk);
      };
      s.onerror = () => {
        sdkPromises.delete(key);
        reject(new Error("PayPal SDK falló al cargar"));
      };
      document.head.appendChild(s);
    });
  })();

  sdkPromises.set(key, promise);
  promise.catch(() => sdkPromises.delete(key));
  return promise;
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
    setLoading(true);
    setErr(null);

    // Cargar Fraudnet apenas se monta el botón para que PayPal disponga de
    // suficiente fingerprint antes del clic. Fuente distinta según flow.
    ensureFraudnet(isSub ? "KNJPRO_Subscription" : "KNJPRO_Checkout");

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
            trackMetaEvent(
              "InitiateCheckout",
              { currency: "USD", content_name: "KNJ PRO Subscription", content_type: "subscription" },
              { email: user?.email },
            );
            const { data, error } = await supabase.functions.invoke("paypal-create-subscription", {
              body: { return_origin: window.location.origin, cmid: getCmid() },
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
            trackMetaEvent(
              "InitiateCheckout",
              {
                currency: "USD",
                ...(p.customAmountUsd ? { value: p.customAmountUsd } : {}),
                ...(p.packageId ? { content_ids: [p.packageId] } : {}),
                content_name: p.packageId ? "Credit package" : "Custom credits",
                content_type: "product",
              },
              { email: user?.email },
            );
            const { data, error } = await supabase.functions.invoke("paypal-create-order", {
              body: p.packageId
                ? { package_id: p.packageId, cmid: getCmid() }
                : { custom_amount_usd: p.customAmountUsd, cmid: getCmid() },
            });
            if (error) throw error;
            const id = (data as any)?.id;
            if (!id) throw new Error((data as any)?.error || "No se pudo crear la orden");
            return id;
          };
          buttonsCfg.onApprove = async (data: any) => {
            const { data: cap, error } = await supabase.functions.invoke("paypal-capture-order", {
              body: { paypal_order_id: data.orderID, cmid: getCmid() },
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
          const btn = paypal.Buttons(buttonsCfg);
          if (btn.isEligible && !btn.isEligible()) {
            setErr("PayPal no disponible en esta región");
            setLoading(false);
            return;
          }
          btn.render(ref.current).catch((e: any) => {
            console.error("Render PayPal buttons:", e);
            if (!cancelled) setErr("No se pudieron mostrar los botones de PayPal");
          });
        } catch (e) {
          console.error("Render PayPal buttons:", e);
          if (!cancelled) setErr("No se pudieron mostrar los botones de PayPal");
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