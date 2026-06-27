import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/badges/Badge";
import { RouteStatusBadge } from "@/components/badges/StatusBadge";
import { RouteWarningBadges } from "@/components/badges/WarningBadge";
import { DateSelector } from "@/components/ui/DateSelector";
import { listRoutes } from "@/features/routes/queries";
import { ensureDailyRoutes } from "@/features/routes/ensure-daily";
import { getOpDate } from "@/lib/persisted-filters";
import { routeTotalPallets, routeUsesMotrice, getRouteWarnings } from "@/lib/warnings";
import { routeShiftLabels, routeLabel } from "@/lib/labels";
import { formatDateIt, tomorrowInputValue, parseDateOnly } from "@/lib/dates";

export default async function GiriPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const selectedDate = date ?? (await getOpDate()) ?? tomorrowInputValue();
  await ensureDailyRoutes(selectedDate);
  const routes = await listRoutes(selectedDate);

  return (
    <div>
      <PageHeader
        title="Giri"
        description={`Giri del ${formatDateIt(parseDateOnly(selectedDate))}`}
      >
        <DateSelector value={selectedDate} label="Data" />
        <Link href={`/giri/nuovo?date=${selectedDate}`} className="btn-primary">
          Nuovo giro
        </Link>
      </PageHeader>

      {routes.length === 0 ? (
        <EmptyState
          title="Nessun giro per questa data"
          description="Crea un nuovo giro per iniziare a pianificare."
          action={{ href: `/giri/nuovo?date=${selectedDate}`, label: "Nuovo giro" }}
        />
      ) : (
        <div className="space-y-3">
          {routes.map((route) => {
            const totalPallets = routeTotalPallets(route);
            const warnings = getRouteWarnings(route);
            return (
              <Link
                key={route.id}
                href={`/giri/${route.id}`}
                className="card block p-4 transition hover:border-brand-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {routeLabel(route)}
                      </span>
                      {routeUsesMotrice(route) ? <Badge tone="purple">Motrice</Badge> : null}
                      <RouteStatusBadge status={route.status} />
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {routeShiftLabels[route.shift]} ·{" "}
                      {route.stops.length} prese · {totalPallets} pallet
                      {route.vehicle?.capacityPallets != null
                        ? ` / ${route.vehicle.capacityPallets}`
                        : ""}
                    </div>
                  </div>
                  <div className="max-w-md">
                    <RouteWarningBadges warnings={warnings} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
