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
  setRouteStatus,
  deleteRoute,
} from "@/features/routes/actions";
import {
  routeTotalPallets,
  routeTotalVolume,
  routeTotalWeight,
  getRouteWarnings,
  hasMissingData,
} from "@/lib/warnings";
import { routeTotalCost, formatEuro } from "@/lib/costs";
import { timeWindowLabels, priorityLabels } from "@/lib/labels";
import { formatDateIt, toDateInputValue } from "@/lib/dates";

export default async function GiroDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const route = await getRoute(id);
  if (!route) notFound();

  const dateStr = toDateInputValue(route.routeDate);
  const [unassigned, drivers, vehicles] = await Promise.all([
    listUnassignedPickups(dateStr),
    listActiveDrivers(),
    listActiveVehicles(),
  ]);

  const totalPallets = routeTotalPallets(route);
  const totalVolume = routeTotalVolume(route);
  const totalWeight = routeTotalWeight(route);
  const totalCost = routeTotalCost(route);
  const warnings = getRouteWarnings(route);
  const redirectTo = `/giri/${route.id}`;

  return (
    <div>
      <PageHeader
        title="Dettaglio giro"
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
            {totalVolume > 0 ? ` · ${totalVolume.toFixed(1)} m³` : ""}
            {totalWeight > 0 ? ` · ${totalWeight.toFixed(0)} kg` : ""}
            {route.vehicle?.capacityPallets != null ? ` / ${route.vehicle.capacityPallets} plt` : ""}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Orari: </span>
          <span className="font-medium text-slate-800">
            {route.departureTime ?? "—"} → {route.returnTime ?? "—"}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Km: </span>
          <span className="font-medium text-slate-800">{route.km ?? "—"}</span>
        </div>
        <div>
          <span className="text-slate-500">Costo stimato: </span>
          <span className="font-semibold text-slate-900">{formatEuro(totalCost)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Colonna sinistra: dati giro + fermate */}
        <div className="space-y-6">
          <RouteForm route={route} drivers={drivers} vehicles={vehicles} defaultDate={dateStr} />

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
                {route.stops.map((stop, idx) => (
                  <li key={stop.id} className="card flex items-start gap-3 p-3">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-800">
                          {stop.pickup.customer.name}
                        </span>
                        <Badge tone="slate">{timeWindowLabels[stop.pickup.timeWindow]}</Badge>
                        {stop.pickup.requiresMotrice ? <Badge tone="purple">Motrice</Badge> : null}
                        {stop.pickup.requiresTailLift ? <Badge tone="blue">Sponda</Badge> : null}
                        {hasMissingData(stop.pickup) ? <MissingDataBadge /> : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {stop.pickup.address.street}, {stop.pickup.address.city} ({stop.pickup.address.province})
                        {" · "}
                        {stop.pickup.pallets ?? "—"} pallet · {priorityLabels[stop.pickup.priority]}
                      </div>
                      {stop.pickup.rawNotes ? (
                        <div className="mt-1 text-xs italic text-slate-400">{stop.pickup.rawNotes}</div>
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
                      <form action={removePickupFromRoute}>
                        <input type="hidden" name="routeId" value={route.id} />
                        <input type="hidden" name="pickupId" value={stop.pickup.id} />
                        <input type="hidden" name="redirectTo" value={redirectTo} />
                        <ConfirmButton variant="danger" className="px-2 py-1">Rimuovi</ConfirmButton>
                      </form>
                    </div>
                  </li>
                ))}
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
          {unassigned.length === 0 ? (
            <div className="card px-4 py-6 text-center text-sm text-slate-500">
              Tutte le prese del giorno sono assegnate.
            </div>
          ) : (
            <ul className="space-y-2">
              {unassigned.map((p) => (
                <li key={p.id} className="card flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{p.customer.name}</span>
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
