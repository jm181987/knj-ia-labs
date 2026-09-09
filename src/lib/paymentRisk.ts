declare global {
  interface Window { MP_DEVICE_SESSION_ID?: string; }
}

export async function getMercadoPagoDeviceId(timeoutMs = 2500): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  const current = String(window.MP_DEVICE_SESSION_ID || "").trim();
  if (current) return current;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const value = String(window.MP_DEVICE_SESSION_ID || "").trim();
    if (value) return value;
  }
  console.warn("Mercado Pago Device ID was not available before checkout timeout");
  return undefined;
}
