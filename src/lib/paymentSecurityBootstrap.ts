import { supabase } from "@/integrations/supabase/client";
import { getMercadoPagoDeviceId } from "@/lib/paymentRisk";

let installed = false;

/**
 * Guarantees that Mercado Pago checkout calls wait briefly for the official
 * security.js Device ID and carry it to the backend. The backend forwards
 * this value as X-meli-session-id, as recommended by Mercado Pago.
 *
 * If the security script is blocked by a browser/privacy extension, checkout
 * is not blocked indefinitely: the request continues without the fingerprint
 * after the bounded wait.
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
          ...(deviceId ? { device_id: deviceId } : {}),
        },
      };
    }
    return originalInvoke(name, options);
  };

  // Warm up collection as soon as the app starts so checkout normally has the
  // fingerprint before the user reaches the pricing screen.
  void getMercadoPagoDeviceId(3000);
}
