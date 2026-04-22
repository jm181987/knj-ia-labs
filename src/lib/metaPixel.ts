import { supabase } from "@/integrations/supabase/client";

const getCookie = (name: string) => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
};

export const trackMetaEvent = async (eventName = "PageView") => {
  const eventSourceUrl = window.location.href;

  try {
    await supabase.functions.invoke("meta-capi-event", {
      body: {
        eventName,
        eventSourceUrl,
        eventId: crypto.randomUUID(),
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
      },
    });
  } catch (error) {
    console.warn("Meta CAPI tracking failed", error);
  }
};