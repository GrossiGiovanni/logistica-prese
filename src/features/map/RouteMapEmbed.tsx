// Widget mappa del giro: mostra il percorso su strada
//   magazzino → fermate (nell'ordine) → magazzino
// tramite Google Maps Embed API (iframe, gratuita).
// Richiede NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (chiave "browser" con Maps Embed API
// abilitata e restrizione per referrer HTTP). È un componente server: costruisce
// solo l'URL dell'iframe, nessun JavaScript lato client.

import { WAREHOUSE_ADDRESS } from "@/lib/distance";

export function RouteMapEmbed({
  stopAddresses,
  apiKey,
}: {
  stopAddresses: string[];
  apiKey: string;
}) {
  if (!apiKey) {
    return (
      <div className="card px-4 py-8 text-center text-sm text-slate-500">
        Mappa non configurata. Imposta <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> (chiave
        browser con Maps Embed API) in <code>.env</code> e su Vercel.
      </div>
    );
  }
  if (stopAddresses.length === 0) {
    return (
      <div className="card px-4 py-8 text-center text-sm text-slate-500">
        Assegna delle prese al giro per visualizzare il percorso sulla mappa.
      </div>
    );
  }

  const params = new URLSearchParams({
    key: apiKey,
    origin: WAREHOUSE_ADDRESS,
    destination: WAREHOUSE_ADDRESS,
    mode: "driving",
    units: "metric",
  });
  params.set("waypoints", stopAddresses.join("|"));
  const src = `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <iframe
        src={src}
        title="Percorso del giro"
        width="100%"
        height={380}
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}
