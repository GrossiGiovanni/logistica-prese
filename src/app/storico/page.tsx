import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { RouteStatusBadge, PickupStatusBadge } from "@/components/badges/StatusBadge";
import { prisma } from "@/lib/db";
import { routeTotalPallets } from "@/lib/warnings";
import { routeTotalCost, formatEuro } from "@/lib/costs";
import { routeLabel, routeShiftLabels } from "@/lib/labels";
import { formatDateIt, parseDateOnly, isValidDateInput, todayInputValue, addDaysInput } from "@/lib/dates";
import { routeInclude } from "@/features/routes/queries";
import type { Prisma } from "@prisma/client";

export default async function StoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; driverId?: string; customerId?: string; vehicleId?: string }>;
}) {
  const sp = await searchParams;
  // Default: ultimi 7 giorni.
  const from = sp.from && isValidDateInput(sp.from) ? sp.from : addDaysInput(todayInputValue(), -7);
  const to = sp.to && isValidDateInput(sp.to) ? sp.to : todayInputValue();
  const { driverId, customerId, vehicleId } = sp;

  const dateRange = { gte: parseDateOnly(from), lte: parseDateOnly(to) };

  const routeWhere: Prisma.RouteWhereInput = { routeDate: dateRange };
  if (driverId) routeWhere.driverId = driverId;
  if (vehicleId) routeWhere.vehicleId = vehicleId;

  const pickupWhere: Prisma.PickupWhereInput = {
    pickupDate: dateRange,
    status: { not: "CANCELLED" },
  };
  if (customerId) pickupWhere.customerId = customerId;
  // Se filtro per autista/mezzo, mostra le prese dei loro giri.
  if (driverId || vehicleId) {
    pickupWhere.routeStops = { some: { route: { ...(driverId ? { driverId } : {}), ...(vehicleId ? { vehicleId } : {}) } } };
  }

  const [routes, pickups, drivers, customers, vehicles] = await Promise.all([
    prisma.route.findMany({
      where: routeWhere,
      include: routeInclude,
      orderBy: [{ routeDate: "desc" }, { createdAt: "asc" }],
      take: 200,
    }),
    prisma.pickup.findMany({
      where: pickupWhere,
      include: {
        customer: { select: { name: true } },
        address: { select: { city: true, province: true } },
        routeStops: {
          select: {
            route: { select: { id: true, driver: { select: { name: true } }, vehicle: { select: { name: true } } } },
          },
        },
      },
      orderBy: [{ pickupDate: "desc" }],
      take: 300,
    }),
    prisma.driver.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.vehicle.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totKm = routes.reduce((s, r) => s + (r.km ?? 0), 0);
  const totCost = routes.reduce((s, r) => s + (routeTotalCost(r) ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Storico"
        description="Consultazione rapida di giri e prese per periodo, autista, cliente e mezzo"
      />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div>
          <label className="field-label">Da</label>
          <input type="date" name="from" defaultValue={from} className="field-input w-auto" />
        </div>
        <div>
          <label className="field-label">A</label>
          <input type="date" name="to" defaultValue={to} className="field-input w-auto" />
        </div>
        <div>
          <label className="field-label">Autista</label>
          <select name="driverId" defaultValue={driverId ?? ""} className="field-input w-auto">
            <option value="">Tutti</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Mezzo</label>
          <select name="vehicleId" defaultValue={vehicleId ?? ""} className="field-input w-auto">
            <option value="">Tutti</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Cliente</label>
          <select name="customerId" defaultValue={customerId ?? ""} className="field-input w-56">
            <option value="">Tutti</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Filtra</button>
          <a href="/storico" className="btn-secondary">Azzera</a>
        </div>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* GIRI */}
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            Giri ({routes.length}) · {Math.round(totKm)} km · {formatEuro(totCost)}
          </h2>
          {routes.length === 0 ? (
            <div className="card px-4 py-6 text-center text-sm text-slate-500">Nessun giro nel periodo con questi filtri.</div>
          ) : (
            <ul className="space-y-2">
              {routes.map((r) => (
                <li key={r.id} className="card flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="whitespace-nowrap text-xs text-slate-500">{formatDateIt(r.routeDate)}</span>
                      <Link href={`/giri/${r.id}`} className="font-medium text-slate-800 hover:underline">
                        {routeLabel(r)}
                      </Link>
                      <RouteStatusBadge status={r.status} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {routeShiftLabels[r.shift]} · {r.stops.length} prese · {routeTotalPallets(r)} plt
                      {r.km != null ? ` · ${r.km} km` : ""}
                      {routeTotalCost(r) != null ? ` · ${formatEuro(routeTotalCost(r))}` : ""}
                    </div>
                  </div>
                  <Link href={`/giri/${r.id}`} className="btn-secondary shrink-0">Apri</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* PRESE */}
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-900">Prese ({pickups.length})</h2>
          {pickups.length === 0 ? (
            <div className="card px-4 py-6 text-center text-sm text-slate-500">Nessuna presa nel periodo con questi filtri.</div>
          ) : (
            <ul className="space-y-2">
              {pickups.map((p) => {
                const route = p.routeStops[0]?.route;
                return (
                  <li key={p.id} className="card flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="whitespace-nowrap text-xs text-slate-500">{formatDateIt(p.pickupDate)}</span>
                        {p.pickupNumber ? (
                          <span className="font-mono text-xs font-semibold text-brand-700">{p.pickupNumber}</span>
                        ) : null}
                        <span className="font-medium text-slate-800">{p.customer.name}</span>
                        <PickupStatusBadge status={p.status} />
                      </div>
                      <div className="text-xs text-slate-500">
                        {p.address.city} ({p.address.province}) · {p.pallets ?? "—"} plt
                        {route ? ` · Giro: ${route.driver?.name ?? "—"} / ${route.vehicle?.name ?? "—"}` : " · Non assegnata"}
                      </div>
                    </div>
                    <Link href={`/prese/${p.id}/modifica`} className="btn-secondary shrink-0">Apri</Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
