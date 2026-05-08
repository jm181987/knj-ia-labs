import { supabase } from "@/integrations/supabase/client";

const COOKIE = "kj_ref";
const STORAGE = "kj_ref_v1";

function setCookie(name: string, value: string, days: number) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
  } catch { /* ignore */ }
}

function readCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  } catch { return null; }
}

export function getStoredRef(): string | null {
  try {
    const c = readCookie(COOKIE);
    if (c) return c;
    const ls = localStorage.getItem(STORAGE);
    if (ls) {
      const obj = JSON.parse(ls);
      if (obj?.code && obj?.expires && Date.now() < obj.expires) return obj.code as string;
    }
  } catch { /* ignore */ }
  return null;
}

export function storeRef(code: string, days = 90) {
  const clean = code.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  if (!clean) return;
  setCookie(COOKIE, clean, days);
  try {
    localStorage.setItem(STORAGE, JSON.stringify({ code: clean, expires: Date.now() + days * 24 * 60 * 60 * 1000 }));
  } catch { /* ignore */ }
}

export function clearRef() {
  setCookie(COOKIE, "", -1);
  try { localStorage.removeItem(STORAGE); } catch { /* ignore */ }
}

export async function trackRefClick(code: string) {
  try {
    await supabase.functions.invoke("affiliate-public", {
      body: { action: "track", code, path: window.location.pathname, referrer: document.referrer || null },
    });
  } catch (e) { console.warn("aff track", e); }
}

export async function attributeRefAfterSignup() {
  const code = getStoredRef();
  if (!code) return false;
  try {
    const { data } = await supabase.functions.invoke("affiliate-self", {
      body: { action: "attribute", code },
    });
    if ((data as any)?.ok) {
      clearRef();
      return true;
    }
  } catch (e) { console.warn("aff attribute", e); }
  return false;
}
