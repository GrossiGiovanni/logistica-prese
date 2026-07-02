"use client";

// Pulsante "Invia giro su WhatsApp": apre wa.me col messaggio precompilato.
// NON invia automaticamente — l'operatore controlla e preme invio in WhatsApp.
// Al click registra anche lo storico (lastWhatsappSentAt).

import { markWhatsappSent } from "./actions";

export function WhatsAppButton({
  routeId,
  digits,
  message,
}: {
  routeId: string;
  digits: string;
  message: string;
  compact?: boolean;
}) {
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  function onOpen() {
    const fd = new FormData();
    fd.set("id", routeId);
    // fire-and-forget: aggiorna lo storico, non blocca l'apertura di WhatsApp
    void markWhatsappSent(fd);
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      title="Invia il giro all'autista su WhatsApp"
      className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2 py-1 text-xs font-medium text-white hover:bg-[#1ebe5b]"
    >
      WhatsApp
    </a>
  );
}
