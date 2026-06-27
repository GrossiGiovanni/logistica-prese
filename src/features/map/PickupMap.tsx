"use client";

// Mappa client-side con i pin delle prese del giorno.
// Carica la JS API di Google con la chiave pubblica NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
// I pin sono colorati: verde = assegnata a un giro, ambra = da assegnare.

import { useMemo, useState } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from "@react-google-maps/api";
import type { PickupMapPoint } from "@/features/pickups/queries";

const CONTAINER_STYLE = { width: "100%", height: "480px", borderRadius: "0.5rem" };
// Centro di fallback: Milano.
const MILAN = { lat: 45.4642, lng: 9.19 };

const TIME_LABELS: Record<string, string> = {
  MORNING: "Mattina",
  AFTERNOON: "Pomeriggio",
  ANYTIME: "Tutto il giorno",
  SPECIFIC: "Orario specifico",
};

export function PickupMap({
  points,
  apiKey,
}: {
  points: PickupMapPoint[];
  apiKey: string;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });
  const [active, setActive] = useState<PickupMapPoint | null>(null);

  const center = useMemo(() => {
    if (points.length === 0) return MILAN;
    const sum = points.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 },
    );
    return { lat: sum.lat / points.length, lng: sum.lng / points.length };
  }, [points]);

  if (!apiKey) {
    return (
      <div className="card px-4 py-8 text-center text-sm text-slate-500">
        Chiave Google Maps non configurata (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="card px-4 py-8 text-center text-sm text-red-600">
        Errore nel caricamento della mappa.
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className="card px-4 py-8 text-center text-sm text-slate-500">
        Caricamento mappa…
      </div>
    );
  }

  const pin = (assigned: boolean) =>
    assigned
      ? "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
      : "https://maps.google.com/mapfiles/ms/icons/orange-dot.png";

  return (
    <GoogleMap mapContainerStyle={CONTAINER_STYLE} center={center} zoom={points.length ? 11 : 10}>
      {points.map((p) => (
        <MarkerF
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          icon={pin(p.assigned)}
          title={p.customerName}
          onClick={() => setActive(p)}
        />
      ))}

      {active ? (
        <InfoWindowF
          position={{ lat: active.lat, lng: active.lng }}
          onCloseClick={() => setActive(null)}
        >
          <div className="text-xs">
            <div className="font-semibold text-slate-900">{active.customerName}</div>
            <div className="text-slate-600">
              {active.city} ({active.province})
            </div>
            <div className="text-slate-600">
              {TIME_LABELS[active.timeWindow] ?? active.timeWindow} · {active.pallets ?? "—"} pallet
            </div>
            <div className={active.assigned ? "text-green-700" : "text-amber-700"}>
              {active.assigned ? "Assegnata" : "Da assegnare"}
            </div>
          </div>
        </InfoWindowF>
      ) : null}
    </GoogleMap>
  );
}
