"use client";

// Pianificazione Plus: lavagna operativa con mappa.
// Pannello sinistro = prese non assegnate (con filtri), centro = mappa
// (magazzino, marker prese, percorsi colorati), destra = giri del giorno con
// fermate espandibili. Si parte "neutri": nessun giro selezionato, l'operatore
// accende quello che vuole confrontare. Hover su una presa in lista = pin rosso.

import { useMemo, useState } from "react";
import Link from "next/link";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, PolylineF } from "@react-google-maps/api";
import { setPickupRoute } from "@/features/routes/actions";
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

export type PlusRouteStop = {
  seq: number;
  warnings: string[];
  pickup: PlusPickup;
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
  stops: PlusRouteStop[];
};

const CONTAINER_STYLE = { width: "100%", height: "100%" };
const HOVER_COLOR = "#ef4444";

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
  // Stato iniziale neutro: NESSUN giro selezionato, l'operatore sceglie cosa vedere.
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(() => new Set());
  // Presa selezionata (dettaglio) e presa in hover (pin rosso sulla mappa).
  const [selected, setSelected] = useState<{ pickup: PlusPickup; routeId?: string } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  // Icona marker: hover vince su tutto (rosso, grande).
  function markerIcon(pickupId: string, baseColor: string, baseScale: number) {
    if (hoveredId === pickupId) return circleIcon(HOVER_COLOR, 13);
    if (selected?.pickup.id === pickupId) return circleIcon(baseColor, baseScale + 3);
    return circleIcon(baseColor, baseScale);
  }

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
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: selectedRoute.color }}
          />
          Giro: <b>{selectedRoute.label}</b>{" "}
          <Link href={`/giri/${selectedRoute.id}`} className="text-brand-700 hover:underline">Apri →</Link>
        </div>
      ) : null}

      {/* Assegnazione: un solo menu con "Da assegnare" sempre presente.
          Si applica al cambio e si chiude subito (niente stati bloccati). */}
      <form action={setPickupRoute} className="pt-1">
        <input type="hidden" name="pickupId" value={selected.pickup.id} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <select
          name="routeId"
          defaultValue={selected.routeId ?? ""}
          onChange={(e) => {
            e.currentTarget.form?.requestSubmit();
            setSelected(null); // chiude menu e dettaglio; la pagina si ricarica coi dati freschi
          }}
          className="field-input w-full py-1 text-xs"
          title="Sposta la presa su un giro o riportala tra le non assegnate"
        >
          <option value="">— Da assegnare —</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.label} · {r.shiftLabel}</option>
          ))}
        </select>
      </form>
    </div>
  ) : null;

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_1fr_340px]" style={{ minHeight: 560 }}>
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
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={
                    "w-full px-3 py-2 text-left text-xs hover:bg-red-50 " +
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

            {/* Prese non assegnate (grigie; rosse se in hover) */}
            {showUnassigned
              ? filteredUnassigned
                  .filter((p) => p.lat != null && p.lng != null)
                  .map((p) => (
                    <MarkerF
                      key={p.id}
                      position={{ lat: p.lat!, lng: p.lng! }}
                      title={p.customer}
                      icon={markerIcon(p.id, p.isBacklog ? "#b91c1c" : "#94a3b8", 8)}
                      zIndex={hoveredId === p.id ? 999 : undefined}
                      onClick={() => setSelected({ pickup: p })}
                    />
                  ))
              : null}

            {/* Fermate dei giri selezionati (numerate, colorate per giro) */}
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
                      icon={markerIcon(s.pickup.id, r.color, 10)}
                      zIndex={hoveredId === s.pickup.id ? 999 : undefined}
                      onClick={() => setSelected({ pickup: s.pickup, routeId: r.id })}
                    />
                  )),
              )}

            {/* Percorsi dei giri selezionati */}
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

      {/* DESTRA: giri del giorno con fermate */}
      <div className="flex max-h-[75vh] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-2 text-sm font-semibold text-slate-900">
          Giri del giorno ({routes.length})
          <span className="ml-1 font-normal text-xs text-slate-400">— spunta per vedere su mappa</span>
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

                {/* Fermate del giro (visibili quando il giro è selezionato) */}
                {visibleRoutes.has(r.id) && r.stops.length > 0 ? (
                  <ol className="mt-2 space-y-1 border-l-2 pl-2" style={{ borderColor: r.color }}>
                    {r.stops.map((s) => (
                      <li key={s.pickup.id}>
                        <button
                          onClick={() => setSelected({ pickup: s.pickup, routeId: r.id })}
                          onMouseEnter={() => setHoveredId(s.pickup.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          className={
                            "w-full rounded px-1.5 py-1 text-left hover:bg-red-50 " +
                            (selected?.pickup.id === s.pickup.id ? "bg-brand-50" : "")
                          }
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{ backgroundColor: r.color }}
                            >
                              {s.seq}
                            </span>
                            {s.pickup.numero ? (
                              <span className="font-mono text-[10px] font-semibold text-brand-700">{s.pickup.numero}</span>
                            ) : null}
                            <span className="truncate font-medium text-slate-800">{s.pickup.customer}</span>
                          </span>
                          <span className="block pl-5 text-slate-500">
                            {s.pickup.address} · {s.pickup.palletEq} plt / {s.pickup.metersEq} m · {s.pickup.timeLabel}
                          </span>
                          {s.warnings.length > 0 ? (
                            <span className="flex flex-wrap gap-1 pl-5 pt-0.5">
                              {s.warnings.map((w) => (
                                <Badge key={w} tone="amber">{w}</Badge>
                              ))}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
