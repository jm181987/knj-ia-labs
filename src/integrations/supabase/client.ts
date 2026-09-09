// Temporary compatibility entrypoint while the UI imports are renamed.
// No Supabase SDK or Supabase service is used here.
import { supabase as backendClient } from "@/integrations/backend/client";
import { getMercadoPagoDeviceId } from "@/lib/paymentRisk";

const functions = {
  async invoke(name: string, options: any = {}) {
    if (name === "mp-create-preference" || name === "mp-create-subscription") {
      const body = { ...(options?.body || {}) };
      if (!body.device_id) body.device_id = await getMercadoPagoDeviceId();
      return backendClient.functions.invoke(name, { ...options, body });
    }
    return backendClient.functions.invoke(name, options);
  },
};

export const supabase = {
  ...backendClient,
  functions,
};

export type { AppUser, AppSession, ApiError } from "@/integrations/backend/client";
