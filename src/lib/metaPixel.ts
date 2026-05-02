import { supabase } from "@/integrations/supabase/client";

const META_PIXEL_ID = "2024535038133024";

export type MetaEventName =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Subscribe"
  | "Purchase";

export interface MetaEventParams {
  value?: number;
  currency?: string;
  content_name?: string;
  content_ids?: string[];
  content_type?: string;
  num_items?: number;
  predicted_ltv?: number;
  [key: string]: unknown;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

const initBrowserPixel = () => {
  if (typeof window === "undefined" || !META_PIXEL_ID) return;

  if (!window.fbq) {
    const fbq = (...args: unknown[]) => {
      (fbq as typeof fbq & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] }).callMethod
        ? (fbq as typeof fbq & { callMethod: (...args: unknown[]) => void }).callMethod(...args)
        : ((fbq as typeof fbq & { queue: unknown[] }).queue.push(args));
    };
    (fbq as typeof fbq & { push: typeof fbq; loaded: boolean; version: string; queue: unknown[] }).push = fbq;
    (fbq as typeof fbq & { loaded: boolean }).loaded = true;
    (fbq as typeof fbq & { version: string }).version = "2.0";
    (fbq as typeof fbq & { queue: unknown[] }).queue = [];
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode?.insertBefore(script, firstScript);
  }

  if (!(window.fbq as typeof window.fbq & { initialized?: boolean })?.initialized) {
    window.fbq("init", META_PIXEL_ID);
    (window.fbq as typeof window.fbq & { initialized?: boolean }).initialized = true;
  }
};

const getCookie = (name: string) => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
};

export const trackMetaEvent = async (
  eventName: MetaEventName = "PageView",
  params: MetaEventParams = {},
  options: { email?: string | null } = {},
) => {
  const eventSourceUrl = window.location.href;
  const eventId = crypto.randomUUID();

  initBrowserPixel();
  // Browser pixel: enviar params para que Meta reciba value/currency/etc.
  window.fbq?.("track", eventName, params, { eventID: eventId });

  try {
    await supabase.functions.invoke("meta-capi-event", {
      body: {
        eventName,
        eventSourceUrl,
        eventId,
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
        email: options.email ?? undefined,
        customData: params,
      },
    });
  } catch (error) {
    console.warn("Meta CAPI tracking failed", error);
  }
};