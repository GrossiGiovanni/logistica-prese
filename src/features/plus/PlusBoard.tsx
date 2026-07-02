"use client";

// Pianificazione Plus: lavagna operativa con mappa.
// Pannello sinistro = prese non assegnate (con filtri), centro = mappa
// (magazzino, marker prese, percorsi colorati), destra = giri del giorno.
// L'assegnazione rapida usa le stesse server action della pianificazione
// classica (quindi km e stati si aggiornano allo stesso modo).

import { useMemo, useState } from "react";
import Link from "next/link";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, PolylineF } from "@react-google-maps/api";
import { assignPickupToRoute } from "@/features/routes/actions";
import { Badge } from "@/components/badges/Badge";

export type PlusPickup = {
  id: string;
  numero: string | null;
  customer: string;
  address: string;
  lat: number | null;
  lng: number | null;
  palletEq: number;
  metersEq: number;
  timeWindow: string;
  timeLabel: string;
  priority: string;
  priorityLabel: string;
  requiresMotrice: boolean;
  statusLabel: string;
  notes: string | null;
  isBacklog: boolean;
  dateLabel: string;
};

export type PlusRoute = {
  id: string;
  label: string;
  shiftLabel: string;
  km: number | null;
  palletTot: number;
  metersTot: number;
  capacity: number | null;
  warnings: string[];
  color: string;
  polyline: string | null;
  stops: { seq: number; pickup: PlusPickup }[];
};

const CONTAINER_STYLE = { width: "100%", height: "100%" };

/** Decodifica una polyline Google (algoritmo standard). */
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const which of ["lat", "lng"] as const) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === "lat") lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function circleIcon(color: string, scale = 9) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

export function PlusBoard({
  warehouse,
  unassigned,
  routes,
  date,
  apiKey,
}: {
  warehouse: { lat: number; lng: number };
  unassigned: PlusPickup[];
  routes: PlusRoute[];
  date: string;
  apiKey: string;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  // Filtri prese non assegnate
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [shiftFilter, setShiftFilter] = useState<"" | "MORNING" | "AFTERNOON">("");
  const [onlyBacklog, setOnlyBacklog] = useState(false);
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [onlyMotrice, setOnlyMotrice] = useState(false);
  // Giri visibili sulla mappa (default: tutti)
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(
    () => new Set(routes.map((r) => r.id)),
  );
  // Presa selezionata (dettaglio / info window). routeId per le prese assegnate.
  const [selected, setSelected] = useState<{ pickup: PlusPickup; routeId?: string } | null>(null);

  const filteredUnassigned = useMemo(
    () =>
      unassigned.filter((p) => {
        if (shiftFilter && p.timeWindow !== shiftFilter) return false;
        if (onlyBacklog && !p.isBacklog) return false;
        if (onlyUrgent && p.priority === "NORMAL") return false;
        if (onlyMotrice && !p.requiresMotrice) return false;
        return true;
      }),
    [unassigned, shiftFilter, onlyBacklog, onlyUrgent, onlyMotrice],
  );

  function toggleRoute(id: string) {
    setVisibleRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const redirectTo = `/pianificazione-plus?date=${date}`;
  const selectedRoute = selected?.routeId ? routes.find((r) => r.id === selected.routeId) : undefined;

  const detail = selected ? (
    <div className="space-y-1 text-xs">
      <div className="flex items-center gap-2">
        {selected.pickup.numero ? (
          <span className="font-mono font-semibold text-brand-700">{selected.pickup.numero}</span>
        ) : null}
        <span className="font-semibold text-slate-900">{selected.pickup.customer}</span>
      </div>
      <div className="text-slate-600">{selected.pickup.address}</div>
      <div className="text-slate-600">
        {selected.pickup.palletEq} plt · {selected.pickup.metersEq} m · {selected.pickup.timeLabel}
        {selected.pickup.priority !== "NORMAL" ? ` · ${selected.pickup.priorityLabel}` : ""}
        {selected.pickup.requiresMotrice ? " · Motrice" : ""}
      </div>
      <div className="text-slate-500">
        {selected.pickup.dateLabel} · Stato: {selected.pickup.statusLabel}
        {selected.pickup.isBacklog ? " · DA RECUPERARE" : ""}
      </div>
      {selected.pickup.notes ? <div className="italic text-slate-500">{selected.pickup.notes}</div> : null}
      {selectedRoute ? (
        <div className="pt-1">
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: selectedRoute.color }} />
          Giro: <b>{selectedRoute.label}</b>{" "}
          <Link href={`/giri/${selectedRoute.id}`} className="text-brand-700 hover:underline">Apri →</Link>
        </div>
      ) : routes.length > 0 ? (
        <form action={assignPickupToRoute} className="flex items-center gap-1 pt-1">
          <input type="hidden" name="pickupId" value={selected.pickup.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <select name="routeId" required defaultValue="" className="field-input w-auto grow py-1 text-xs">
            <option value="" disabled>Assegna al giro…</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.label} · {r.shiftLabel}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary px-2 py-1 text-xs">OK</button>
        </form>
      ) : (
        <div className="text-slate-400">Nessun giro per questa data: creane uno per assegnare.</div>
      )}
    </div>
  ) : null;

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_1fr_320px]" style={{ minHeight: 560 }}>
      {/* SINISTRA: prese non assegnate */}
      <div className="flex max-h-[75vh] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <input type="checkbox" checked={showUnassigned} onChange={(e) => setShowUnassigned(e.target.checked)} />
            Non assegnate ({filteredUnassigned.length})
          </label>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value as typeof shiftFilter)}
              className="field-input w-full py-1 text-xs"
            >
              <option value="">Tutte le fasce</option>
              <option value="MORNING">Solo mattina</option>
              <option value="AFTERNOON">Solo pomeriggio</option>
            </select>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
              <label className="flex items-center gap-1"><input type="checkbox" checked={onlyBacklog} onChange={(e) => setOnlyBacklog(e.target.checked)} />Arretrate</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={onlyUrgent} onChange={(e) => setOnlyUrgent(e.target.checked)} />Urgenti</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={onlyMotrice} onChange={(e) => setOnlyMotrice(e.target.checked)} />Motrice</label>
            </div>
          </div>
        </div>
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {filteredUnassigned.length === 0 ? (
            <li className="p-3 text-xs text-slate-400">Nessuna presa con questi filtri.</li>
          ) : (
            filteredUnassigned.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelected({ pickup: p })}
                  className={
                    "w-full px-3 py-2 text-left text-xs hover:bg-slate-50 " +
                    (selected?.pickup.id === p.id ? "bg-brand-50" : "")
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800">{p.customer}</span>
                    {p.isBacklog ? <Badge tone="red">Recupero</Badge> : null}
                    {p.lat == null ? <Badge tone="slate">no mappa</Badge> : null}
                  </div>
                  <div className="text-slate-500">
                    {p.address} · {p.palletEq} plt · {p.timeLabel}
                  </div>
                </button>
                {selected?.pickup.id === p.id && !selected.routeId ? (
                  <div className="border-t border-brand-100 bg-brand-50/50 px-3 py-2">{detail}</div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>

      {/* CENTRO: mappa */}
      <div className="min-h-[420px] overflow-hidden rounded-lg border border-slate-200" style={{ height: "75vh" }}>
        {loadError ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-red-600">
            Errore nel caricamento della mappa: verifica che la chiave browser abbia la
            &quot;Maps JavaScript API&quot; abilitata su Google Cloud.
          </div>
        ) : !isLoaded ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Caricamento mappa…</div>
        ) : (
          <GoogleMap mapContainerStyle={CONTAINER_STYLE} center={warehouse} zoom={10}>
            {/* Magazzino */}
            <MarkerF
              position={warehouse}
              title="Magazzino — partenza e rientro"
              label={{ text: "M", color: "#ffffff", fontSize: "11px", fontWeight: "bold" }}
              icon={{ ...circleIcon("#0f172a", 11) }}
              zIndex={1000}
            />

            {/* Prese non assegnate (grigie) */}
            {showUnassigned
              ? filteredUnassigned
                  .filter((p) => p.lat != null && p.lng != null)
                  .map((p) => (
                    <MarkerF
                      key={p.id}
                      position={{ lat: p.lat!, lng: p.lng! }}
                      title={p.customer}
                      icon={circleIcon(p.isBacklog ? "#dc2626" : "#94a3b8", selected?.pickup.id === p.id ? 11 : 8)}
                      onClick={() => setSelected({ pickup: p })}
                    />
                  ))
              : null}

            {/* Fermate dei giri visibili (numerate, colorate per giro) */}
            {routes
              .filter((r) => visibleRoutes.has(r.id))
              .map((r) =>
                r.stops
                  .filter((s) => s.pickup.lat != null && s.pickup.lng != null)
                  .map((s) => (
                    <MarkerF
                      key={s.pickup.id}
                      position={{ lat: s.pickup.lat!, lng: s.pickup.lng! }}
                      title={`${s.seq}. ${s.pickup.customer} (${r.label})`}
                      label={{ text: String(s.seq), color: "#ffffff", fontSize: "10px", fontWeight: "bold" }}
                      icon={circleIcon(r.color, selected?.pickup.id === s.pickup.id ? 12 : 10)}
                      onClick={() => setSelected({ pickup: s.pickup, routeId: r.id })}
                    />
                  )),
              )}

            {/* Percorsi dei giri visibili */}
            {routes
              .filter((r) => visibleRoutes.has(r.id) && r.polyline)
              .map((r) => (
                <PolylineF
                  key={r.id}
                  path={decodePolyline(r.polyline!)}
                  options={{ strokeColor: r.color, strokeOpacity: 0.75, strokeWeight: 4 }}
                />
              ))}

            {/* Dettaglio presa sulla mappa */}
            {selected && selected.pickup.lat != null && selected.pickup.lng != null ? (
              <InfoWindowF
                position={{ lat: selected.pickup.lat, lng: selected.pickup.lng }}
                onCloseClick={() => setSelected(null)}
              >
                <div className="max-w-[16rem]">{detail}</div>
              </InfoWindowF>
            ) : null}
          </GoogleMap>
        )}
      </div>

      {/* DESTRA: giri del giorno */}
      <div className="flex max-h-[75vh] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-2 text-sm font-semibold text-slate-900">
          Giri del giorno ({routes.length})
        </div>
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {routes.length === 0 ? (
            <li className="p-3 text-xs text-slate-400">
              Nessun giro per questa data. <Link href={`/giri/nuovo?date=${date}`} className="text-brand-700 hover:underline">Crea un giro</Link>
            </li>
          ) : (
            routes.map((r) => (
              <li key={r.id} className="p-2.5 text-xs">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={visibleRoutes.has(r.id)}
                    onChange={() => toggleRoute(r.id)}
                    className="mt-0.5"
                  />
                  <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-1">
                      <span className="truncate font-semibold text-slate-900">{r.label}</span>
                      <Link href={`/giri/${r.id}`} className="shrink-0 text-brand-700 hover:underline">Apri</Link>
                    </span>
                    <span className="block text-slate-500">
                      {r.shiftLabel} · {r.stops.length} prese · {r.palletTot}
                      {r.capacity != null ? `/${r.capacity}` : ""} plt · {r.metersTot} m
                      {r.km != null ? ` · ${r.km} km` : ""}
                    </span>
                    {r.warnings.length > 0 ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {r.warnings.map((w) => (
                          <Badge key={w} tone="red">{w}</Badge>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
