import { supabase } from "@/integrations/supabase/client";
import { getMercadoPagoDeviceId } from "@/lib/paymentRisk";

const PAYMENT_ORIGIN = "https://www.knjpro.site";
let installed = false;

/**
 * Ensures payment-provider checkout calls use the canonical production domain.
 * Mercado Pago calls also wait briefly for the official security.js Device ID
 * so the backend can forward it as X-meli-session-id.
 */
export function installPaymentSecurity() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const functions = (supabase as any).functions;
  const originalInvoke = functions.invoke.bind(functions);

  functions.invoke = async (name: string, options: any = {}) => {
    if (name === "mp-create-preference" || name === "mp-create-subscription") {
      const existing = String(options?.body?.device_id || "").trim();
      const deviceId = existing || (await getMercadoPagoDeviceId(3000));
      options = {
        ...options,
        body: {
          ...(options?.body || {}),
          return_origin: PAYMENT_ORIGIN,
          ...(deviceId ? { device_id: deviceId } : {}),
        },
      };
    } else if (name === "paypal-create-subscription") {
      options = {
        ...options,
        body: {
          ...(options?.body || {}),
          return_origin: PAYMENT_ORIGIN,
        },
      };
    }
    return originalInvoke(name, options);
  };

  // Warm up collection as soon as the app starts so checkout normally has the
  // fingerprint before the user reaches the pricing screen.
  void getMercadoPagoDeviceId(3000);
}
