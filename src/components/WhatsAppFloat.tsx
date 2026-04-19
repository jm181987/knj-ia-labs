import { useAuth } from "@/hooks/useAuth";

export function WhatsAppFloat() {
  const { user } = useAuth();
  const email = user?.email || "";
  const message = encodeURIComponent(
    `Hola vengo de la plataforma KNJ PRO, soy ${email}`.trim()
  );
  const href = `https://wa.me/59894920949?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/30 grid place-items-center hover:scale-110 transition-transform animate-pulse hover:animate-none"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.173-.43.273-.91.273-1.39 0-.014 0-.043-.014-.058-.05-.156-2.378-1.246-2.722-1.246zm-2.564 7.583c-1.745 0-3.46-.515-4.92-1.476l-3.432 1.118 1.118-3.346a8.927 8.927 0 0 1-1.706-5.27c0-4.92 4.02-8.94 8.94-8.94s8.94 4.02 8.94 8.94c.014 4.92-4.005 8.974-8.94 8.974zm0-19.6C10.713 5.188 5.853 10.034 5.853 16c0 1.92.5 3.802 1.45 5.444L5.4 27l5.7-1.86a10.84 10.84 0 0 0 5.444 1.404C22.5 26.544 27.36 21.7 27.36 15.732c.014-5.968-4.846-10.815-10.815-10.815z"/>
      </svg>
    </a>
  );
}
