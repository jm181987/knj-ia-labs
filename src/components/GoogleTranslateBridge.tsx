import { useEffect } from "react";
import { useTranslation } from "react-i18next";

// Mapea i18n → códigos de Google Translate
const MAP: Record<string, string> = {
  es: "es",
  en: "en",
  pt: "pt",
  fr: "fr",
  it: "it",
  de: "de",
};

function setGoogleTransCookie(lang: string) {
  const value = `/en/${lang}`;
  // Cookie a nivel host y dominio raíz para que Google Translate la lea
  document.cookie = `googtrans=${value}; path=/`;
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length > 1) {
    const root = "." + parts.slice(-2).join(".");
    document.cookie = `googtrans=${value}; path=/; domain=${root}`;
  }
}

/** Aplica el idioma actual de i18n al widget de Google Translate. */
export function GoogleTranslateBridge() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const lang = MAP[i18n.language?.split("-")[0]] || "en";
    const current = document.cookie.split("; ").find((c) => c.startsWith("googtrans="))?.split("=")[1];
    const desired = `/en/${lang}`;
    if (current === desired) return;
    setGoogleTransCookie(lang);
    // Recargar para que Google Translate aplique el nuevo idioma de manera limpia
    window.location.reload();
  }, [i18n.language]);

  return null;
}
