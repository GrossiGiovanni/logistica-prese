// Un quadrante di "Pianificazione Fabio": vista compatta e di sola lettura che
// replica le informazioni della Pianificazione (prese, giri, KPI, pallet, metri,
// km, warning, stato assegnazione) con i filtri indipendenti del quadrante.

import Link from "next/link";
import { Badge } from "@/components/badges/Badge";
import { RouteStatusBadge } from "@/components/badges/StatusBadge";
import { MissingDataBadge, RouteWarningBadges } from "@/components/badges/WarningBadge";
import {
  routeTotalPallets,
  routeOccupiedMeters,
  routeResiCount,
  routeUsesMotrice,
  getRouteWarnings,
  hasMissingData,
} from "@/lib/warnings";
import { routeTotalCost, formatEuro } from "@/lib/costs";
import { routeShiftLabels, priorityLabels, routeLabel } from "@/lib/labels";
import { formatDateIt, parseDateOnly } from "@/lib/dates";
import { QuadrantFilters, type QuadrantCurrent } from "./QuadrantFilters";
import type { QuadrantData } from "./queries";

function Kpi({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5 text-center">
      <div className="text-[9px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={"text-sm font-bold " + (tone || "text-slate-800")}>{value}</div>
    </div>
  );
}

export function Quadrant({
  q,
  branchName,
  current,
  data,
  branches,
}: {
  q: number;
  branchName: string;
  current: QuadrantCurrent;
  data: QuadrantData;
  branches: { id: string; name: string; code: string }[];
}) {
  const { pickups, routes, kpi, overlapIds, options } = data;

  return (
    <section className="flex h-[80vh] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Intestazione quadrante */}
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">Q{q}</span>
          <span className="text-sm font-semibold text-slate-800">{branchName}</span>
          <span className="text-xs text-slate-500">{formatDateIt(parseDateOnly(current.date))}</span>
        </div>
      </div>

      {/* Filtri indipendenti */}
      <div className="border-b border-slate-200 px-3 py-2">
        <QuadrantFilters
          q={q}
          branches={branches}
          customers={options.customers}
          drivers={options.drivers}
          vehicles={options.vehicles}
          routes={options.routes}
          current={current}
        />
      </div>

      {/* KPI / riepiloghi */}
      <div className="grid grid-cols-3 gap-1.5 border-b border-slate-200 px-3 py-2 sm:grid-cols-6">
        <Kpi label="Prese" value={kpi.dayTotal} />
        <Kpi
          label="Da assegn."
          value={kpi.dayUnassigned}
          tone={kpi.dayUnassigned > 0 ? "text-amber-600" : "text-emerald-600"}
        />
        <Kpi label="Giri" value={kpi.routesCount} />
        <Kpi label="Pallet" value={kpi.palletTot} />
        <Kpi label="Metri" value={kpi.metriTot} />
        <Kpi label="Km" value={kpi.kmTot} />
      </div>

      {/* Corpo: prese (sx) + giri (dx) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-2">
        {/* PRESE */}
        <div className="flex min-h-0 flex-col border-r border-slate-100">
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-600">Prese ({pickups.length})</div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
            {pickups.length === 0 ? (
              <div className="rounded-md bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
                Nessuna presa con questi filtri.
              </div>
            ) : (
              pickups.map((p) => {
                const rs = p.routeStops[0]?.route;
                return (
                  <div key={p.id} className="rounded-md border border-slate-100 p-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.pickupNumber ? (
                        <span className="font-mono font-semibold text-brand-700">{p.pickupNumber}</span>
                      ) : null}
                      <Link href={`/prese/${p.id}/modifica`} className="font-medium text-slate-800 hover:underline">
                        {p.customer.name}
                      </Link>
                      {p.priority !== "NORMAL" ? <Badge tone="red">{priorityLabels[p.priority]}</Badge> : null}
                      {p.requiresMotrice ? <Badge tone="purple">Motrice</Badge> : null}
                      {p.timeWindow === "MORNING" ? <Badge tone="amber">Mattina</Badge> : null}
                      {p.timeWindow === "AFTERNOON" ? <Badge tone="amber">Pom.</Badge> : null}
                      {hasMissingData(p) ? <MissingDataBadge /> : null}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {p.address.city} ({p.address.province}) · {p.pallets ?? "—"} plt
                      {p.loadingMeters != null ? ` · ${p.loadingMeters} mtl` : ""}
                    </div>
                    <div className="mt-1">
                      {rs ? (
                        <Link href={`/giri/${rs.id}`} className="inline-flex items-center gap-1 hover:underline">
                          <Badge tone="green">In giro</Badge>
                          <span className="text-[11px] text-slate-500">{routeLabel(rs)}</span>
                        </Link>
                      ) : (
                        <Badge tone="slate">Da assegnare</Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* GIRI */}
        <div className="flex min-h-0 flex-col">
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-600">Giri ({routes.length})</div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
            {routes.length === 0 ? (
              <div className="rounded-md bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
                Nessun giro con questi filtri.
              </div>
            ) : (
              routes.map((r) => {
                const warnings = getRouteWarnings(r);
                if (overlapIds.has(r.id)) warnings.push("resource_overlap");
                const total = routeTotalPallets(r);
                const capExceeded = r.vehicle?.capacityPallets != null && total > r.vehicle.capacityPallets;
                const cost = routeTotalCost(r);
                return (
                  <div key={r.id} className="rounded-md border border-slate-100 p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link href={`/giri/${r.id}`} className="font-semibold text-slate-900 hover:underline">
                            {routeLabel(r)}
                          </Link>
                          {routeUsesMotrice(r) ? <Badge tone="purple">Motrice</Badge> : null}
                          <RouteStatusBadge status={r.status} />
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {routeShiftLabels[r.shift]} · {r.stops.filter((s) => s.pickup).length} prese
                          {routeResiCount(r) > 0 ? ` · ${routeResiCount(r)} resi` : ""} ·{" "}
                          <span className={capExceeded ? "font-semibold text-red-600" : ""}>
                            {total}
                            {r.vehicle?.capacityPallets != null ? `/${r.vehicle.capacityPallets}` : ""} plt
                          </span>
                          {` · ${routeOccupiedMeters(r)} m`}
                          {r.km != null ? ` · ${r.km} km` : ""}
                          {cost != null ? ` · ${formatEuro(cost)}` : ""}
                        </div>
                      </div>
                    </div>
                    {warnings.length > 0 ? (
                      <div className="mt-1">
                        <RouteWarningBadges warnings={warnings} />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
