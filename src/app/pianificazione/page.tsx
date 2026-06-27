import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { Badge } from "@/components/badges/Badge";
import { RouteStatusBadge } from "@/components/badges/StatusBadge";
import { MissingDataBadge, RouteWarningBadges } from "@/components/badges/WarningBadge";
import { DateSelector } from "@/components/ui/DateSelector";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { getDailyStats } from "@/features/dashboard/queries";
import { listUnassignedPickups } from "@/features/pickups/queries";
import { assignPickupToRoute } from "@/features/routes/actions";
import { GenerateRecurringForm } from "@/features/recurring-pickups/GenerateRecurringForm";
import {
  routeTotalPallets,
  routeUsesMotrice,
  getRouteWarnings,
  hasMissingData,
} from "@/lib/warnings";
import { routeTotalCost, formatEuro } from "@/lib/costs";
import { routeShiftLabels, timeWindowLabels, priorityLabels } from "@/lib/labels";
import { formatDateIt, tomorrowInputValue, parseDateOnly } from "@/lib/dates";

export default async function PianificazionePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const selectedDate = date ?? tomorrowInputValue();
  const redirectTo = `/pianificazione?date=${selectedDate}`;

  const [{ routes, kpi }, unassigned] = await Promise.all([
    getDailyStats(selectedDate),
    listUnassignedPickups(selectedDate),
  ]);

  return (
    <div>
      <PageHeader
        title="Pianificazione"
        description={`Schermata operativa del ${formatDateIt(parseDateOnly(selectedDate))}`}
      >
        <DateSelector value={selectedDate} label="Giorno" />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/giri/nuovo?date=${selectedDate}`} className="btn-primary">
          Nuovo giro
        </Link>
        <GenerateRecurringForm date={selectedDate} redirectTo={redirectTo} compact />
        <Link href={`/prese/nuova?date=${selectedDate}`} className="btn-secondary">
          Nuova presa
        </Link>
      </div>

      <KpiGrid>
        <KpiCard label="Prese totali" value={kpi.total} />
        <KpiCard label="Non assegnate" value={kpi.unassigned} tone={kpi.unassigned > 0 ? "amber" : "green"} />
        <KpiCard label="Dati mancanti" value={kpi.missingData} tone={kpi.missingData > 0 ? "amber" : "green"} />
        <KpiCard label="Giri" value={kpi.routesCount} />
        <KpiCard label="Mezzi usati" value={kpi.vehiclesUsed} />
        <KpiCard label="Motrici usate" value={kpi.motriciUsed} tone={kpi.motriciUsed > 0 ? "red" : "default"} />
      </KpiGrid>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* SINISTRA: prese non assegnate */}
        <div>
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            Prese non assegnate ({unassigned.length})
          </h2>
          {unassigned.length === 0 ? (
            <div className="card px-4 py-8 text-center text-sm text-slate-500">
              Nessuna presa da assegnare. Genera le prese fisse o creane una spot.
            </div>
          ) : (
            <ul className="space-y-2">
              {unassigned.map((p) => (
                <li key={p.id} className="card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/prese/${p.id}/modifica`} className="font-medium text-slate-800 hover:underline">
                      {p.customer.name}
                    </Link>
                    {p.priority !== "NORMAL" ? <Badge tone="red">{priorityLabels[p.priority]}</Badge> : null}
                    {p.requiresMotrice ? <Badge tone="purple">Motrice</Badge> : null}
                    {p.requiresTailLift ? <Badge tone="blue">Sponda</Badge> : null}
                    {p.timeWindow === "MORNING" ? <Badge tone="amber">Mattina</Badge> : null}
                    {p.timeWindow === "AFTERNOON" ? <Badge tone="amber">Pomeriggio</Badge> : null}
                    {hasMissingData(p) ? <MissingDataBadge /> : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {p.address.city} ({p.address.province}) · {timeWindowLabels[p.timeWindow]} · {p.pallets ?? "—"} pallet
                  </div>

                  {routes.length === 0 ? (
                    <div className="mt-2 text-xs text-slate-400">
                      Crea un giro per poter assegnare.
                    </div>
                  ) : (
                    <form action={assignPickupToRoute} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="pickupId" value={p.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <select name="routeId" required defaultValue="" className="field-input w-auto grow text-sm">
                        <option value="" disabled>Assegna al giro…</option>
                        {routes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {(r.vehicle?.name ?? "Mezzo da assegnare") + " · " + routeShiftLabels[r.shift]}
                          </option>
                        ))}
                      </select>
                      <ConfirmButton variant="secondary">Assegna</ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* DESTRA: giri del giorno */}
        <div>
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            Giri del giorno ({routes.length})
          </h2>
          {routes.length === 0 ? (
            <div className="card px-4 py-8 text-center text-sm text-slate-500">
              Nessun giro. Crea il primo giro per iniziare.
            </div>
          ) : (
            <ul className="space-y-2">
              {routes.map((r) => {
                const warnings = getRouteWarnings(r);
                const total = routeTotalPallets(r);
                const capExceeded =
                  r.vehicle?.capacityPallets != null && total > r.vehicle.capacityPallets;
                return (
                  <li key={r.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/giri/${r.id}`} className="font-semibold text-slate-900 hover:underline">
                            {r.vehicle?.name ?? "Mezzo da assegnare"}
                          </Link>
                          {routeUsesMotrice(r) ? <Badge tone="purple">Motrice</Badge> : null}
                          <RouteStatusBadge status={r.status} />
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {routeShiftLabels[r.shift]} · {r.driver?.name ?? "Autista da assegnare"} · {r.stops.length} prese ·{" "}
                          <span className={capExceeded ? "font-semibold text-red-600" : ""}>
                            {total}
                            {r.vehicle?.capacityPallets != null ? ` / ${r.vehicle.capacityPallets}` : ""} pallet
                          </span>
                          {routeTotalCost(r) != null ? ` · ${formatEuro(routeTotalCost(r))}` : ""}
                        </div>
                      </div>
                      <Link href={`/giri/${r.id}`} className="btn-secondary shrink-0">Apri giro</Link>
                    </div>
                    {warnings.length > 0 ? (
                      <div className="mt-2">
                        <RouteWarningBadges warnings={warnings} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
