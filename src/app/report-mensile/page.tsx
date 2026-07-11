import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { prisma } from "@/lib/db";
import { routeTotalCost, formatEuro } from "@/lib/costs";
import { toDateInputValue, todayInputValue } from "@/lib/dates";
import { routeInclude } from "@/features/routes/queries";

// Limiti teorici giornalieri per il controllo km autisti
const KM_LIMIT_PER_DAY = { BILICO: 300, MOTRICE: 250 } as const;
const DEFAULT_KM_LIMIT = 300;

/** Giorni lavorativi (lun-ven) di un mese, opzionalmente limitati a un intervallo. */
function workdaysBetween(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

export default async function ReportMensilePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const today = todayInputValue();
  const selectedMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);

  const [yearStr, monthStr] = selectedMonth.split("-");
  const year = Number(yearStr);
  const mon = Number(monthStr);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 0)); // ultimo giorno del mese
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  // Fine del periodo "maturato": oggi se siamo nel mese, altrimenti fine mese.
  const elapsedEnd = todayDate < monthEnd ? (todayDate < monthStart ? monthStart : todayDate) : monthEnd;

  const [routes, pickups, drivers] = await Promise.all([
    prisma.route.findMany({
      where: { routeDate: { gte: monthStart, lte: monthEnd } },
      include: routeInclude,
    }),
    prisma.pickup.findMany({
      where: { pickupDate: { gte: monthStart, lte: monthEnd }, status: { not: "CANCELLED" } },
      select: { pickupDate: true },
    }),
    prisma.driver.findMany({
      where: { active: true },
      select: { id: true, name: true, defaultVehicle: { select: { vehicleType: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  // --- Medie giornaliere sui giorni con operatività registrata ---
  const vehiclesByDay = new Map<string, Set<string>>();
  const costByDay = new Map<string, number>();
  for (const r of routes) {
    const day = toDateInputValue(r.routeDate);
    if (r.vehicleId) {
      if (!vehiclesByDay.has(day)) vehiclesByDay.set(day, new Set());
      vehiclesByDay.get(day)!.add(r.vehicleId);
    }
    const cost = routeTotalCost(r);
    if (cost != null) costByDay.set(day, (costByDay.get(day) ?? 0) + cost);
  }
  const pickupsByDay = new Map<string, number>();
  for (const p of pickups) {
    const day = toDateInputValue(p.pickupDate);
    pickupsByDay.set(day, (pickupsByDay.get(day) ?? 0) + 1);
  }

  const operativeDays = new Set([...vehiclesByDay.keys(), ...pickupsByDay.keys(), ...costByDay.keys()]);
  const nOperative = operativeDays.size;

  const avg = (total: number, n: number) => (n > 0 ? total / n : 0);
  const avgVehicles = avg([...vehiclesByDay.values()].reduce((s, set) => s + set.size, 0), nOperative);
  const avgPickups = avg([...pickupsByDay.values()].reduce((s, n) => s + n, 0), nOperative);
  const totalCost = [...costByDay.values()].reduce((s, c) => s + c, 0);
  const avgCost = avg(totalCost, costByDay.size || nOperative);

  // --- Proiezione costo a fine mese ---
  const workdaysRemaining =
    todayDate < monthEnd
      ? workdaysBetween(new Date(elapsedEnd.getTime() + 86400000), monthEnd)
      : 0;
  const projectedCost = totalCost + avgCost * workdaysRemaining;

  // --- Controllo km autisti ---
  const monthWorkdays = workdaysBetween(monthStart, monthEnd);
  const kmByDriver = new Map<string, number>();
  for (const r of routes) {
    if (r.driverId && r.km != null) {
      kmByDriver.set(r.driverId, (kmByDriver.get(r.driverId) ?? 0) + r.km);
    }
  }
  const kmRows = drivers
    .map((d) => {
      const type = d.defaultVehicle?.vehicleType;
      const dailyLimit = type && type in KM_LIMIT_PER_DAY
        ? KM_LIMIT_PER_DAY[type as keyof typeof KM_LIMIT_PER_DAY]
        : DEFAULT_KM_LIMIT;
      const monthlyLimit = dailyLimit * monthWorkdays;
      const km = Math.round((kmByDriver.get(d.id) ?? 0) * 10) / 10;
      const pct = monthlyLimit > 0 ? (km / monthlyLimit) * 100 : 0;
      return { id: d.id, name: d.name, dailyLimit, monthlyLimit, km, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const monthLabel = new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div>
      <PageHeader
        title="Report mensile"
        description={`Medie, proiezione costi e controllo km — ${monthLabel}`}
      >
        <form method="get" className="flex items-end gap-2">
          <input type="month" name="month" defaultValue={selectedMonth} className="field-input w-auto" />
          <button type="submit" className="btn-secondary">Vai</button>
        </form>
      </PageHeader>

      {/* Medie giornaliere */}
      <h2 className="mb-2 text-base font-semibold text-slate-900">
        Medie giornaliere ({nOperative} giorni con operatività)
      </h2>
      <KpiGrid>
        <KpiCard label="Mezzi utilizzati / giorno" value={avgVehicles.toFixed(1)} />
        <KpiCard label="Prese effettuate / giorno" value={avgPickups.toFixed(1)} />
        <KpiCard label="Costo medio / giorno" value={avgCost > 0 ? formatEuro(Math.round(avgCost)) : "—"} />
      </KpiGrid>

      {/* Proiezione costo */}
      <h2 className="mb-2 mt-8 text-base font-semibold text-slate-900">Proiezione costo a fine mese</h2>
      <KpiGrid>
        <KpiCard label="Costo già registrato" value={totalCost > 0 ? formatEuro(Math.round(totalCost)) : "—"} />
        <KpiCard label="Media costo / giorno" value={avgCost > 0 ? formatEuro(Math.round(avgCost)) : "—"} />
        <KpiCard label="Giorni lavorativi mancanti" value={workdaysRemaining} />
        <KpiCard
          label="Costo previsto fine mese"
          value={projectedCost > 0 ? formatEuro(Math.round(projectedCost)) : "—"}
          tone="blue"
          hint={`registrato + media × ${workdaysRemaining} gg`}
        />
      </KpiGrid>

      {/* Controllo km autisti */}
      <h2 className="mb-2 mt-8 text-base font-semibold text-slate-900">
        Chilometri autisti — limite mensile teorico ({monthWorkdays} giorni lavorativi: bilico 300 km/g, motrice 250 km/g)
      </h2>
      <div className="space-y-2">
        {kmRows.map((d) => {
          const clamped = Math.min(d.pct, 100);
          const barColor = d.pct >= 100 ? "bg-red-500" : d.pct >= 80 ? "bg-amber-500" : "bg-brand-600";
          const residui = Math.round((d.monthlyLimit - d.km) * 10) / 10;
          return (
            <div key={d.id} className="card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-slate-800">{d.name}</span>
                <span className="text-xs text-slate-500">
                  {d.km} km / {d.monthlyLimit} km · residui {residui} km ·{" "}
                  <span className={d.pct >= 100 ? "font-semibold text-red-600" : d.pct >= 80 ? "font-semibold text-amber-600" : ""}>
                    {d.pct.toFixed(0)}%
                  </span>
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${clamped}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
