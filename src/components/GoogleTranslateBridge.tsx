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

/**
 * Sincroniza el idioma de i18n con el widget de Google Translate
 * sin recargar la página. Espera a que el <select> del widget esté
 * disponible y dispara un evento change.
 */
export function GoogleTranslateBridge() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const target = MAP[i18n.language?.split("-")[0]] || "en";

    const apply = () => {
      const select = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
      if (!select) return false;
      if (select.value === target) return true;
      select.value = target;
      select.dispatchEvent(new Event("change"));
      return true;
    };

    if (apply()) return;

    // El widget tarda un momento en montar el <select>. Reintentamos hasta 10s.
    let tries = 0;
    const interval = window.setInterval(() => {
      tries++;
      if (apply() || tries > 50) window.clearInterval(interval);
    }, 200);

    return () => window.clearInterval(interval);
  }, [i18n.language]);

  return null;
}
