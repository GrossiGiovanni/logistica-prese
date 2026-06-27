import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { Badge } from "@/components/badges/Badge";
import { PickupStatusBadge, RouteStatusBadge } from "@/components/badges/StatusBadge";
import { MissingDataBadge } from "@/components/badges/WarningBadge";
import { DateSelector } from "@/components/ui/DateSelector";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDailyStats } from "@/features/dashboard/queries";
import { ensureRecurringForDate } from "@/features/recurring-pickups/generate";
import { getOpDate } from "@/lib/persisted-filters";
import { hasMissingData, routeTotalPallets, routeUsesMotrice } from "@/lib/warnings";
import { routeTotalCost, formatEuro } from "@/lib/costs";
import { routeShiftLabels, timeWindowLabels, routeLabel } from "@/lib/labels";
import { formatDateIt, tomorrowInputValue, parseDateOnly } from "@/lib/dates";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const selectedDate = date ?? (await getOpDate()) ?? tomorrowInputValue();

  await ensureRecurringForDate(selectedDate);

  const { pickups, routes, kpi } = await getDailyStats(selectedDate);

  const dailyCost = routes.reduce((sum, r) => sum + (routeTotalCost(r) ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Riepilogo operativo del ${formatDateIt(parseDateOnly(selectedDate))}`}
      >
        <DateSelector value={selectedDate} label="Giorno" />
        <Link href={`/pianificazione?date=${selectedDate}`} className="btn-primary">
          Vai alla pianificazione
        </Link>
      </PageHeader>

      <KpiGrid>
        <KpiCard label="Prese totali" value={kpi.total} />
        <KpiCard label="Prese fisse" value={kpi.recurring} tone="blue" />
        <KpiCard label="Prese spot" value={kpi.spot} />
        <KpiCard label="Non assegnate" value={kpi.unassigned} tone={kpi.unassigned > 0 ? "amber" : "green"} />
        <KpiCard label="Dati mancanti" value={kpi.missingData} tone={kpi.missingData > 0 ? "amber" : "green"} />
        <KpiCard label="Giri creati" value={kpi.routesCount} />
        <KpiCard label="Mezzi usati" value={kpi.vehiclesUsed} />
        <KpiCard label="Motrici usate" value={kpi.motriciUsed} tone={kpi.motriciUsed > 0 ? "red" : "default"} hint="Costo alto" />
        <KpiCard label="Costo giornata" value={dailyCost > 0 ? formatEuro(dailyCost) : "—"} hint="Stima giri del giorno" />
      </KpiGrid>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Prese del giorno */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Prese del giorno</h2>
            <Link href="/prese" className="text-sm text-brand-700 hover:underline">Tutte le prese</Link>
          </div>
          {pickups.length === 0 ? (
            <EmptyState title="Nessuna presa" description="Nessuna presa per questa data." />
          ) : (
            <ul className="space-y-2">
              {pickups.map((p) => (
                <li key={p.id} className="card flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/prese/${p.id}/modifica`} className="font-medium text-slate-800 hover:underline">
                        {p.customer.name}
                      </Link>
                      {p.sourceType === "RECURRING" ? <Badge tone="blue">Fissa</Badge> : null}
                      {hasMissingData(p) ? <MissingDataBadge /> : null}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.address.city} ({p.address.province}) · {timeWindowLabels[p.timeWindow]} · {p.pallets ?? "—"} pallet
                    </div>
                  </div>
                  <PickupStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Giri del giorno */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Giri del giorno</h2>
            <Link href={`/giri?date=${selectedDate}`} className="text-sm text-brand-700 hover:underline">Tutti i giri</Link>
          </div>
          {routes.length === 0 ? (
            <EmptyState title="Nessun giro" description="Nessun giro creato per questa data." />
          ) : (
            <ul className="space-y-2">
              {routes.map((r) => (
                <li key={r.id} className="card flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/giri/${r.id}`} className="font-medium text-slate-800 hover:underline">
                        {routeLabel(r)}
                      </Link>
                      {routeUsesMotrice(r) ? <Badge tone="purple">Motrice</Badge> : null}
                    </div>
                    <div className="text-xs text-slate-500">
                      {routeShiftLabels[r.shift]} · {r.driver?.name ?? "—"} · {r.stops.length} prese · {routeTotalPallets(r)} pallet
                      {r.km != null ? ` · ${r.km} km` : ""}
                      {routeTotalCost(r) != null ? ` · ${formatEuro(routeTotalCost(r))}` : ""}
                    </div>
                  </div>
                  <RouteStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
