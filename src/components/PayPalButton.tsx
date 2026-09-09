import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { trackMetaEvent } from "@/lib/metaPixel";

let cachedCmid: string | null = null;
function getCmid(): string {
  if (cachedCmid) return cachedCmid;
  const rnd = (globalThis.crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  cachedCmid = `knjpro-${rnd}`.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36);
  return cachedCmid;
}

let fraudnetLoaded = false;
function ensureFraudnet(sourceIdentifier: string, sandbox: boolean) {
  if (typeof document === "undefined" || fraudnetLoaded) return;
  const cfg = document.createElement("script");
  cfg.type = "application/json";
  cfg.setAttribute("fncls", "fnparams-dede7cc5-15fd-4c75-a9f4-36c430ee3a99");
  cfg.text = JSON.stringify({ f: getCmid(), s: sourceIdentifier, sandbox });
  document.head.appendChild(cfg);
  const s = document.createElement("script");
  s.src = "https://c.paypal.com/da/r/fb.js";
  s.async = true;
  document.head.appendChild(s);
  fraudnetLoaded = true;
}

type PaypalConfig = {
  client_id: string;
  mode: "sandbox" | "production";
  oauth_ok?: boolean;
  oauth_code?: string | null;
  alternate_mode_match?: boolean;
  webhook_configured?: boolean;
};
let cachedConfig: PaypalConfig | null = null;
let configPromise: Promise<PaypalConfig> | null = null;
async function getPaypalConfig(): Promise<PaypalConfig> {
  if (cachedConfig?.oauth_ok) return cachedConfig;
  if (configPromise) return configPromise;
  configPromise = (async () => {
    const { data, error } = await supabase.functions.invoke("paypal-config", { body: {} });
    if (error) throw new Error(error.message);
    const cfg = (data || {}) as PaypalConfig;
    if (!cfg.client_id) throw new Error("PAYPAL_CLIENT_ID no configurado en el backend");
    if (cfg.oauth_ok === false) {
      if (cfg.alternate_mode_match) {
        throw new Error(`Las credenciales de PayPal corresponden a ${cfg.mode === "production" ? "Sandbox" : "Live"}, pero el servidor está configurado como ${cfg.mode === "production" ? "Live" : "Sandbox"}. Corrige PAYPAL_MODE o usa las credenciales del mismo entorno.`);
      }
      throw new Error(`PayPal rechazó PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET en ${cfg.mode === "production" ? "Live" : "Sandbox"}. Copia el Client ID y Secret de la misma app y entorno en Vercel.`);
    }
    cachedConfig = cfg;
    return cfg;
  })();
  try { return await configPromise; }
  finally { configPromise = null; }
}

const sdkPromises = new Map<string, Promise<any>>();
function namespaceFor(opts: { intent: "capture" | "subscription"; vault?: boolean }) {
  return opts.intent === "subscription" ? "paypal_sub" : "paypal_cap";
}
async function loadPaypalSdk(opts: { intent: "capture" | "subscription"; vault?: boolean }) {
  if (typeof window === "undefined") return null;
  const ns = namespaceFor(opts);
  const existing = (window as any)[ns];
  if (existing) return existing;
  if (sdkPromises.has(ns)) return sdkPromises.get(ns)!;

  const promise = (async () => {
    const cfg = await getPaypalConfig();
    ensureFraudnet(opts.intent === "subscription" ? "KNJPRO_Subscription" : "KNJPRO_Checkout", cfg.mode === "sandbox");
    if (opts.intent === "subscription" && cfg.webhook_configured === false) {
      console.warn("PayPal subscription webhook is not configured; set PAYPAL_WEBHOOK_ID before going live.");
    }
    return await new Promise<any>((resolve, reject) => {
      const params = new URLSearchParams({ "client-id": cfg.client_id, currency: "USD", intent: opts.intent, components: "buttons" });
      if (opts.vault) params.set("vault", "true");
      const s = document.createElement("script");
      s.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
      s.async = true;
      s.dataset.paypalSdk = ns;
      s.setAttribute("data-namespace", ns);
      s.onload = () => {
        const sdk = (window as any)[ns];
        if (!sdk) return reject(new Error("PayPal SDK no expuso namespace " + ns));
        resolve(sdk);
      };
      s.onerror = () => { sdkPromises.delete(ns); reject(new Error("PayPal SDK falló al cargar")); };
      document.head.appendChild(s);
    });
  })();
  sdkPromises.set(ns, promise);
  promise.catch(() => sdkPromises.delete(ns));
  return promise;
}

interface OneTimeProps { mode: "order"; packageId?: string; customAmountUsd?: number; disabled?: boolean; onSuccess?: (credits: number) => void; }
interface SubProps { mode: "subscription"; disabled?: boolean; onSuccess?: () => void; }
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
    setLoading(true); setErr(null);
    loadPaypalSdk({ intent: isSub ? "subscription" : "capture", vault: isSub })
      .then((paypal) => {
        if (cancelled || !paypal || !ref.current) return;
        ref.current.innerHTML = "";
        const requireAuth = () => { if (!user) { navigate("/auth"); return false; } return true; };
        const buttonsCfg: any = {
          style: { layout: "horizontal", color: "blue", shape: "rect", label: isSub ? "subscribe" : "paypal", height: 44, tagline: false },
          onError: (e: any) => { console.error("PayPal error:", e); toast({ title: "Error de PayPal", description: String(e?.message || e), variant: "destructive" }); },
          onCancel: () => toast({ title: "Pago cancelado", description: "No se realizó ningún cargo." }),
        };

        if (isSub) {
          buttonsCfg.createSubscription = async () => {
            if (!requireAuth()) throw new Error("Debes iniciar sesión");
            trackMetaEvent("InitiateCheckout", { currency: "USD", content_name: "KNJ PRO Subscription", content_type: "subscription" }, { email: user?.email });
            const { data, error } = await supabase.functions.invoke("paypal-create-subscription", { body: { return_origin: window.location.origin, cmid: getCmid() } });
            if (error) throw new Error(error.message);
            const subId = (data as any)?.subscription_id;
            if (!subId) throw new Error((data as any)?.error || "No se pudo crear la suscripción");
            return subId;
          };
          buttonsCfg.onApprove = async () => { toast({ title: "Suscripción aprobada", description: "Los créditos se acreditarán automáticamente." }); (props as SubProps).onSuccess?.(); };
        } else {
          buttonsCfg.createOrder = async () => {
            if (!requireAuth()) throw new Error("Debes iniciar sesión");
            const p = props as OneTimeProps;
            trackMetaEvent("InitiateCheckout", { currency: "USD", ...(p.customAmountUsd ? { value: p.customAmountUsd } : {}), ...(p.packageId ? { content_ids: [p.packageId] } : {}), content_name: p.packageId ? "Credit package" : "Custom credits", content_type: "product" }, { email: user?.email });
            const { data, error } = await supabase.functions.invoke("paypal-create-order", { body: p.packageId ? { package_id: p.packageId, cmid: getCmid() } : { custom_amount_usd: p.customAmountUsd, cmid: getCmid() } });
            if (error) throw new Error(error.message);
            const id = (data as any)?.id;
            if (!id) throw new Error((data as any)?.error || "No se pudo crear la orden");
            return id;
          };
          buttonsCfg.onApprove = async (data: any) => {
            const { data: cap, error } = await supabase.functions.invoke("paypal-capture-order", { body: { paypal_order_id: data.orderID, cmid: getCmid() } });
            if (error) { toast({ title: "Error capturando pago", description: error.message, variant: "destructive" }); return; }
            const credits = (cap as any)?.credits;
            toast({ title: "¡Pago aprobado!", description: `Se acreditaron ${credits} créditos.` });
            (props as OneTimeProps).onSuccess?.(credits);
          };
        }

        try {
          const btn = paypal.Buttons(buttonsCfg);
          if (btn.isEligible && !btn.isEligible()) { setErr("PayPal no disponible para este comprador o dispositivo"); setLoading(false); return; }
          btn.render(ref.current).catch((e: any) => { console.error("Render PayPal buttons:", e); if (!cancelled) setErr("No se pudieron mostrar los botones de PayPal"); });
        } catch (e) { console.error("Render PayPal buttons:", e); if (!cancelled) setErr("No se pudieron mostrar los botones de PayPal"); }
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setErr(e.message); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, (props as any).packageId, (props as any).customAmountUsd, (props as any).disabled, user]);

  if (err) return <p className="text-xs text-destructive">{err}</p>;
  return <div className="relative min-h-[44px]">{loading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}<div ref={ref} className={props.disabled ? "opacity-50 pointer-events-none" : ""} /></div>;
}
