// Statistiche mensili di filiale (consuntivo + forecast), condivise tra la
// Home Dashboard e il Report mensile per NON duplicare la business logic.
// Il costo usa le stesse funzioni del consuntivo operativo (routeTotalCost):
// la proiezione a fine mese è semplicemente "registrato + media × giorni rimasti".

import { prisma } from "@/lib/db";
import { routeInclude } from "@/features/routes/queries";
import { routeTotalCost, splitCosts, type CostSplit } from "@/lib/costs";
import { toDateInputValue, todayInputValue } from "@/lib/dates";

// Limiti teorici giornalieri per il controllo km autisti.
export const KM_LIMIT_PER_DAY = { BILICO: 300, MOTRICE: 250 } as const;
export const DEFAULT_KM_LIMIT = 300;

export type KmRow = {
  id: string;
  name: string;
  dailyLimit: number;
  monthlyLimit: number;
  km: number;
  pct: number;
};

export type MonthlyStats = {
  month: string; // "YYYY-MM"
  monthLabel: string; // es. "agosto 2026"
  // --- consuntivo (registrato nel mese) ---
  pickupsCount: number;
  volumeM3: number;
  pallets: number;
  routesCount: number;
  registeredCost: number;
  /** Ripartizione del costo registrato: industriale vs padroncini. */
  costSplit: CostSplit;
  /** Noli dei carichi del mese (confluiscono nei costi esterni). */
  noliCost: number;
  // --- medie giornaliere (sui giorni con operatività) ---
  operativeDays: number;
  avgVehiclesPerDay: number;
  avgPickupsPerDay: number;
  avgVolumePerDay: number;
  avgCostPerDay: number;
  // --- forecast a fine mese ---
  workdaysTotal: number;
  workdaysRemaining: number;
  projectedPickups: number;
  projectedVolume: number;
  projectedCost: number;
  // --- classifiche ---
  topCustomer: { name: string; count: number; volume: number } | null;
  topDriver: { name: string; pickups: number; routes: number } | null;
  // --- controllo km autisti ---
  kmRows: KmRow[];
};

/** Giorni lavorativi (lun-ven) tra due date incluse. */
export function workdaysBetween(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

/** Normalizza un input "YYYY-MM" (o qualunque valore) al mese valido corrente. */
export function normalizeMonth(month?: string): string {
  return month && /^\d{4}-\d{2}$/.test(month) ? month : todayInputValue().slice(0, 7);
}

/**
 * Calcola tutte le statistiche mensili della filiale per il mese "YYYY-MM".
 * Un'unica fonte usata sia dalla Home sia dal Report mensile.
 */
export async function getMonthlyStats(branchId: string, month: string): Promise<MonthlyStats> {
  const selectedMonth = normalizeMonth(month);
  const [yearStr, monthStr] = selectedMonth.split("-");
  const year = Number(yearStr);
  const mon = Number(monthStr);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 0)); // ultimo giorno del mese

  const today = todayInputValue();
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  // Fine del periodo "maturato": oggi se siamo nel mese, altrimenti fine mese.
  const elapsedEnd =
    todayDate < monthEnd ? (todayDate < monthStart ? monthStart : todayDate) : monthEnd;

  const [routes, pickups, drivers, tractions, carichi] = await Promise.all([
    prisma.route.findMany({
      where: { branchId, routeDate: { gte: monthStart, lte: monthEnd } },
      include: routeInclude,
    }),
    prisma.pickup.findMany({
      where: { branchId, pickupDate: { gte: monthStart, lte: monthEnd }, status: { not: "CANCELLED" } },
      select: {
        pickupDate: true,
        pallets: true,
        // Volume "tassabile": solo il consuntivo arrivato dall'import AS400.
        taxableVolumeM3: true,
        customerId: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.driver.findMany({
      where: { branchId, active: true },
      select: { id: true, name: true, defaultVehicle: { select: { vehicleType: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.traction.findMany({
      where: { branchId, tractionDate: { gte: monthStart, lte: monthEnd } },
      select: {
        tractionDate: true,
        cost: true,
        km: true,
        driverId: true,
        driver: { select: { industrialTractions: true } },
      },
    }),
    // Noli dei carichi: costi di trazione esterni del mese.
    prisma.carico.findMany({
      where: { branchId, loadDate: { gte: monthStart, lte: monthEnd } },
      select: { loadDate: true, nolo: true },
    }),
  ]);

  // --- Totali consuntivo ---
  const pickupsCount = pickups.length;
  // Volume a consuntivo (tassabile), non il previsionale di pianificazione.
  const volumeM3 = pickups.reduce((s, p) => s + (p.taxableVolumeM3 ?? 0), 0);
  const pallets = pickups.reduce((s, p) => s + (p.pallets ?? 0), 0);
  const routesCount = routes.length;
  const routesCost = routes.reduce((s, r) => s + (routeTotalCost(r) ?? 0), 0);
  const tractionsCost = tractions.reduce((s, t) => s + (t.cost ?? 0), 0);
  const noliCost = carichi.reduce((s, c) => s + (c.nolo ?? 0), 0);
  const registeredCost = routesCost + tractionsCost + noliCost;

  // Ripartizione industriale / padroncini.
  const costSplit = splitCosts({
    routes: routes.map((r) => ({
      cost: routeTotalCost(r) ?? 0,
      industrial: r.driver?.industrialRoutes ?? false,
    })),
    tractions: tractions.map((t) => ({
      cost: t.cost ?? 0,
      industrial: t.driver?.industrialTractions ?? false,
    })),
    otherExternal: noliCost,
  });

  // --- Aggregazioni per giorno (per le medie) ---
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
  for (const t of tractions) {
    if (t.cost == null) continue;
    const day = toDateInputValue(t.tractionDate);
    costByDay.set(day, (costByDay.get(day) ?? 0) + t.cost);
  }
  // I noli dei carichi entrano nel costo della giornata.
  for (const c of carichi) {
    if (c.nolo == null) continue;
    const day = toDateInputValue(c.loadDate);
    costByDay.set(day, (costByDay.get(day) ?? 0) + c.nolo);
  }
  const pickupsByDay = new Map<string, number>();
  for (const p of pickups) {
    const day = toDateInputValue(p.pickupDate);
    pickupsByDay.set(day, (pickupsByDay.get(day) ?? 0) + 1);
  }

  const operativeDaySet = new Set([
    ...vehiclesByDay.keys(),
    ...pickupsByDay.keys(),
    ...costByDay.keys(),
  ]);
  const operativeDays = operativeDaySet.size;

  const avg = (total: number, n: number) => (n > 0 ? total / n : 0);
  const avgVehiclesPerDay = avg(
    [...vehiclesByDay.values()].reduce((s, set) => s + set.size, 0),
    operativeDays,
  );
  const avgPickupsPerDay = avg(pickupsCount, operativeDays);
  const avgVolumePerDay = avg(volumeM3, operativeDays);
  const avgCostPerDay = avg(registeredCost, costByDay.size || operativeDays);

  // --- Forecast a fine mese: registrato + media × giorni lavorativi rimasti ---
  const workdaysTotal = workdaysBetween(monthStart, monthEnd);
  const workdaysRemaining =
    todayDate < monthEnd
      ? workdaysBetween(new Date(elapsedEnd.getTime() + 86400000), monthEnd)
      : 0;
  const projectedPickups = pickupsCount + avgPickupsPerDay * workdaysRemaining;
  const projectedVolume = volumeM3 + avgVolumePerDay * workdaysRemaining;
  const projectedCost = registeredCost + avgCostPerDay * workdaysRemaining;

  // --- Top cliente (per numero prese, spareggio sul volume) ---
  const byCustomer = new Map<string, { name: string; count: number; volume: number }>();
  for (const p of pickups) {
    const entry = byCustomer.get(p.customerId) ?? { name: p.customer.name, count: 0, volume: 0 };
    entry.count += 1;
    entry.volume += p.taxableVolumeM3 ?? 0;
    byCustomer.set(p.customerId, entry);
  }
  const topCustomer =
    [...byCustomer.values()].sort((a, b) => b.count - a.count || b.volume - a.volume)[0] ?? null;

  // --- Top autista (per prese consegnate nei suoi giri, spareggio sui giri) ---
  const byDriver = new Map<string, { name: string; pickups: number; routes: number }>();
  for (const r of routes) {
    if (!r.driver) continue;
    const ritiri = r.stops.filter((s) => s.pickup != null).length;
    const entry = byDriver.get(r.driver.id) ?? { name: r.driver.name, pickups: 0, routes: 0 };
    entry.pickups += ritiri;
    entry.routes += 1;
    byDriver.set(r.driver.id, entry);
  }
  const topDriver =
    [...byDriver.values()].sort((a, b) => b.pickups - a.pickups || b.routes - a.routes)[0] ?? null;

  // --- Controllo km autisti (limite mensile teorico) ---
  const kmByDriver = new Map<string, number>();
  for (const r of routes) {
    if (r.driverId && r.km != null) {
      kmByDriver.set(r.driverId, (kmByDriver.get(r.driverId) ?? 0) + r.km);
    }
  }
  for (const t of tractions) {
    if (t.driverId && t.km != null) {
      kmByDriver.set(t.driverId, (kmByDriver.get(t.driverId) ?? 0) + t.km);
    }
  }
  const kmRows: KmRow[] = drivers
    .map((d) => {
      const type = d.defaultVehicle?.vehicleType;
      const dailyLimit =
        type && type in KM_LIMIT_PER_DAY
          ? KM_LIMIT_PER_DAY[type as keyof typeof KM_LIMIT_PER_DAY]
          : DEFAULT_KM_LIMIT;
      const monthlyLimit = dailyLimit * workdaysTotal;
      const km = Math.round((kmByDriver.get(d.id) ?? 0) * 10) / 10;
      const pct = monthlyLimit > 0 ? (km / monthlyLimit) * 100 : 0;
      return { id: d.id, name: d.name, dailyLimit, monthlyLimit, km, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const monthLabel = monthStart.toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return {
    month: selectedMonth,
    monthLabel,
    pickupsCount,
    volumeM3,
    pallets,
    routesCount,
    registeredCost,
    costSplit,
    noliCost,
    operativeDays,
    avgVehiclesPerDay,
    avgPickupsPerDay,
    avgVolumePerDay,
    avgCostPerDay,
    workdaysTotal,
    workdaysRemaining,
    projectedPickups,
    projectedVolume,
    projectedCost,
    topCustomer,
    topDriver,
    kmRows,
  };
}
