import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/badges/Badge";
import { RouteWarningBadges, MissingDataBadge } from "@/components/badges/WarningBadge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { RouteForm } from "@/features/routes/RouteForm";
import { getRoute } from "@/features/routes/queries";
import { listUnassignedPickups } from "@/features/pickups/queries";
import { listActiveDrivers } from "@/features/drivers/queries";
import { listActiveVehicles } from "@/features/vehicles/queries";
import {
  moveStop,
  removePickupFromRoute,
  assignPickupToRoute,
  setResoRoute,
  setRouteStatus,
  deleteRoute,
  recalculateRouteKm,
} from "@/features/routes/actions";
import { StopQuantityEdit } from "@/features/routes/StopQuantityEdit";
import {
  routeTotalPallets,
  routeTotalVolume,
  routeTotalWeight,
  routeOccupiedMeters,
  routeResiCount,
  pickupPalletEquivalent,
  getRouteWarnings,
  hasMissingData,
} from "@/lib/warnings";
import { routeTotalCost, formatEuro } from "@/lib/costs";
import { pointParam } from "@/lib/distance";
import { RouteMapEmbed } from "@/features/map/RouteMapEmbed";
import { WhatsAppButton } from "@/features/routes/WhatsAppButton";
import {
  buildWhatsappMessage,
  isValidWhatsappNumber,
  whatsappDigits,
} from "@/features/routes/whatsapp-message";
import { timeWindowLabels, priorityLabels, routeLabel } from "@/lib/labels";
import { formatDateIt, toDateInputValue } from "@/lib/dates";

export default async function GiroDettaglioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const route = await getRoute(id);
  if (!route) notFound();

  const dateStr = toDateInputValue(route.routeDate);
  const [unassigned, activeDrivers, activeVehicles] = await Promise.all([
    listUnassignedPickups(dateStr, { search: q || undefined }),
    listActiveDrivers(),
    listActiveVehicles(),
  ]);

  // Includi sempre autista/mezzo già assegnati tra le opzioni (anche se inattivi),
  // così la select non si svuota mai e un salvataggio non azzera l'assegnazione.
  const drivers =
    route.driver && !activeDrivers.some((d) => d.id === route.driver!.id)
      ? [...activeDrivers, route.driver]
      : activeDrivers;
  const vehicles =
    route.vehicle && !activeVehicles.some((v) => v.id === route.vehicle!.id)
      ? [...activeVehicles, route.vehicle]
      : activeVehicles;

  const totalPallets = routeTotalPallets(route);
  const totalVolume = routeTotalVolume(route);
  const totalWeight = routeTotalWeight(route);
  const totalMeters = routeOccupiedMeters(route);
  const totalResi = routeResiCount(route);
  const totalCost = routeTotalCost(route);
  const warnings = getRouteWarnings(route);
  const redirectTo = `/giri/${route.id}`;

  // Waypoint = coordinate salvate (le stesse del calcolo km), testo in riserva.
  // Include ritiri e resi (entrambi tappe); salta le fermate senza indirizzo.
  const stopAddresses = route.stops
    .map((s) => s.pickup?.address ?? s.reso?.address)
    .filter((a): a is NonNullable<typeof a> => a != null)
    .map((a) => pointParam(a));
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  // WhatsApp: visibile solo con autista WhatsApp-abilitato e almeno una presa.
  const waEnabled = Boolean(route.driver?.whatsappEnabled) && route.stops.length > 0;
  const waValidNumber = isValidWhatsappNumber(route.driver?.phone);

  return (
    <div>
      <PageHeader
        title={routeLabel(route)}
        description={`${formatDateIt(route.routeDate)} · ${route.stops.length} prese · ${totalPallets} pallet`}
      >
        <Link href={`/giri?date=${dateStr}`} className="btn-secondary">
          Tutti i giri
        </Link>
        <form action={setRouteStatus}>
          <input type="hidden" name="id" value={route.id} />
          <input
            type="hidden"
            name="status"
            value={route.status === "CONFIRMED" ? "DRAFT" : "CONFIRMED"}
          />
          <ConfirmButton variant="primary">
            {route.status === "CONFIRMED" ? "Riporta in bozza" : "Conferma giro"}
          </ConfirmButton>
        </form>
      </PageHeader>

      {warnings.length > 0 ? (
        <div className="mb-4">
          <RouteWarningBadges warnings={warnings} />
        </div>
      ) : null}

      <div className="card mb-4 flex flex-wrap gap-x-8 gap-y-2 p-3 text-sm">
        <div>
          <span className="text-slate-500">Carico: </span>
          <span className="font-medium text-slate-800">
            {totalPallets} plt
            {route.vehicle?.capacityPallets != null ? ` / ${route.vehicle.capacityPallets}` : ""}
            {" · "}
            {totalMeters} m
            {totalVolume > 0 ? ` · ${totalVolume.toFixed(1)} m³` : ""}
            {totalWeight > 0 ? ` · ${totalWeight.toFixed(0)} kg` : ""}
          </span>
          {totalResi > 0 ? (
            <span className="ml-2 text-slate-500">· Resi: <b className="text-slate-700">{totalResi}</b></span>
          ) : null}
        </div>
        <div>
          <span className="text-slate-500">Orari: </span>
          <span className="font-medium text-slate-800">
            {route.departureTime ?? "—"} → {route.returnTime ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            <span className="text-slate-500">Km: </span>
            <span className="font-medium text-slate-800">
              {route.km != null ? `${route.km} km` : "—"}
            </span>
          </span>
          <form action={recalculateRouteKm}>
            <input type="hidden" name="id" value={route.id} />
            <button type="submit" className="btn-secondary px-2 py-1 text-xs" title="Ricalcola i km dalle fermate">
              Ricalcola
            </button>
          </form>
        </div>
        <div>
          <span className="text-slate-500">Costo stimato: </span>
          <span className="font-semibold text-slate-900">{formatEuro(totalCost)}</span>
        </div>
      </div>

      {waEnabled ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {waValidNumber ? (
            <WhatsAppButton
              routeId={route.id}
              digits={whatsappDigits(route.driver?.phone)}
              message={buildWhatsappMessage(route)}
            />
          ) : (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Numero WhatsApp mancante (aggiungilo nella scheda autista)
            </span>
          )}
          {route.lastWhatsappSentAt ? (
            <span className="text-xs text-slate-400">
              Ultimo invio: {formatDateIt(route.lastWhatsappSentAt)}
            </span>
          ) : null}
        </div>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-slate-900">Percorso del giro</h2>
        <RouteMapEmbed stopAddresses={stopAddresses} apiKey={mapsApiKey} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Colonna sinistra: dati giro + fermate */}
        <div className="space-y-6">
          <RouteForm
            key={`${route.id}:${route.driverId ?? ""}:${route.vehicleId ?? ""}`}
            route={route}
            drivers={drivers}
            vehicles={vehicles}
            defaultDate={dateStr}
          />

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">
              Fermate ({route.stops.length})
            </h2>
            {route.stops.length === 0 ? (
              <div className="card px-4 py-6 text-center text-sm text-slate-500">
                Nessuna fermata. Assegna le prese dalla colonna a destra.
              </div>
            ) : (
              <ol className="space-y-2">
                {route.stops.map((stop, idx) => {
                  const p = stop.pickup;
                  const reso = stop.reso;
                  return (
                    <li key={stop.id} className="card flex items-start gap-3 p-3">
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                          {idx + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        {p ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              {p.pickupNumber ? (
                                <span className="font-mono text-xs font-semibold text-brand-700">{p.pickupNumber}</span>
                              ) : null}
                              <span className="font-medium text-slate-800">{p.customer.name}</span>
                              <Badge tone="slate">{timeWindowLabels[p.timeWindow]}</Badge>
                              {p.requiresMotrice ? <Badge tone="purple">Motrice</Badge> : null}
                              {p.requiresTailLift ? <Badge tone="blue">Sponda</Badge> : null}
                              {hasMissingData(p) ? <MissingDataBadge /> : null}
                            </div>
                            <div className="text-xs text-slate-500">
                              {p.address.street}, {p.address.city} ({p.address.province})
                              {" · "}
                              {Math.round(pickupPalletEquivalent(p))} plt
                              {p.colli != null ? ` · ${p.colli} colli` : ""}
                              {p.weightKg != null ? ` · ${p.weightKg} kg` : ""}
                              {p.volumeM3 != null ? ` · ${p.volumeM3} m³` : ""}
                            </div>
                            {p.rawNotes ? (
                              <div className="mt-1 text-xs italic text-slate-400">{p.rawNotes}</div>
                            ) : null}
                            <StopQuantityEdit
                              pickupId={p.id}
                              redirectTo={redirectTo}
                              values={{
                                pallets: p.pallets,
                                loadingMeters: p.loadingMeters,
                                colli: p.colli,
                                weightKg: p.weightKg,
                                volumeM3: p.volumeM3,
                              }}
                            />
                          </>
                        ) : reso ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              {reso.distintaNumber ? (
                                <span className="font-mono text-xs font-semibold text-brand-700">{reso.distintaNumber}</span>
                              ) : null}
                              <span className="font-medium text-slate-800">{reso.customer.name}</span>
                              <Badge tone="purple">Reso</Badge>
                            </div>
                            <div className="text-xs text-slate-500">
                              {reso.address ? `${reso.address.street}, ${reso.address.city} (${reso.address.province}) · ` : ""}
                              {[
                                reso.resiCount != null ? `${reso.resiCount} resi` : null,
                                reso.pallets != null ? `${reso.pallets} plt` : null,
                                reso.colli != null ? `${reso.colli} colli` : null,
                              ].filter(Boolean).join(" · ") || "—"}
                            </div>
                            {reso.notes ? (
                              <div className="mt-1 text-xs italic text-slate-400">{reso.notes}</div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <form action={moveStop}>
                          <input type="hidden" name="routeId" value={route.id} />
                          <input type="hidden" name="stopId" value={stop.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button type="submit" disabled={idx === 0} className="btn-secondary px-2 py-1" title="Su">↑</button>
                        </form>
                        <form action={moveStop}>
                          <input type="hidden" name="routeId" value={route.id} />
                          <input type="hidden" name="stopId" value={stop.id} />
                          <input type="hidden" name="direction" value="down" />
                          <button type="submit" disabled={idx === route.stops.length - 1} className="btn-secondary px-2 py-1" title="Giù">↓</button>
                        </form>
                        {p ? (
                          <form action={removePickupFromRoute}>
                            <input type="hidden" name="routeId" value={route.id} />
                            <input type="hidden" name="pickupId" value={p.id} />
                            <input type="hidden" name="redirectTo" value={redirectTo} />
                            <ConfirmButton variant="danger" className="px-2 py-1">Rimuovi</ConfirmButton>
                          </form>
                        ) : reso ? (
                          <form action={setResoRoute}>
                            <input type="hidden" name="resoId" value={reso.id} />
                            <input type="hidden" name="routeId" value="" />
                            <input type="hidden" name="redirectTo" value={redirectTo} />
                            <ConfirmButton variant="danger" className="px-2 py-1">Rimuovi</ConfirmButton>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <form action={deleteRoute}>
            <input type="hidden" name="id" value={route.id} />
            <ConfirmButton variant="danger" confirm="Eliminare l'intero giro? Le prese torneranno disponibili.">
              Elimina giro
            </ConfirmButton>
          </form>
        </div>

        {/* Colonna destra: prese non assegnate */}
        <div>
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            Prese non assegnate ({unassigned.length})
          </h2>
          <form method="get" className="mb-3 flex items-end gap-2">
            <div className="grow">
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Cerca cliente, n. presa, località…"
                className="field-input"
              />
            </div>
            <button type="submit" className="btn-secondary">Cerca</button>
            {q ? <a href={`/giri/${route.id}`} className="btn-secondary">Azzera</a> : null}
          </form>
          {unassigned.length === 0 ? (
            <div className="card px-4 py-6 text-center text-sm text-slate-500">
              {q ? "Nessuna presa trovata con questa ricerca." : "Tutte le prese del giorno sono assegnate."}
            </div>
          ) : (
            <ul className="space-y-2">
              {unassigned.map((p) => (
                <li key={p.id} className="card flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.pickupNumber ? (
                        <span className="font-mono text-xs font-semibold text-brand-700">{p.pickupNumber}</span>
                      ) : null}
                      <span className="font-medium text-slate-800">{p.customer.name}</span>
                      {toDateInputValue(p.pickupDate) !== dateStr ? (
                        <Badge tone="red">Da recuperare · {formatDateIt(p.pickupDate)}</Badge>
                      ) : null}
                      {p.priority !== "NORMAL" ? <Badge tone="red">{priorityLabels[p.priority]}</Badge> : null}
                      {p.requiresMotrice ? <Badge tone="purple">Motrice</Badge> : null}
                      {hasMissingData(p) ? <MissingDataBadge /> : null}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.address.city} ({p.address.province}) · {timeWindowLabels[p.timeWindow]} · {p.pallets ?? "—"} pallet
                    </div>
                  </div>
                  <form action={assignPickupToRoute}>
                    <input type="hidden" name="routeId" value={route.id} />
                    <input type="hidden" name="pickupId" value={p.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <ConfirmButton variant="secondary" className="shrink-0">Assegna</ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
