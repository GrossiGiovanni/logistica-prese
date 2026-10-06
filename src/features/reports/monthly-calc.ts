// Calcoli del report mensile (consuntivo + forecast), puri e senza database:
// monthly.ts carica i dati, qui si fanno i conti. Testati in monthly-calc.test.ts.
//
// Regole:
// - Consuntivo ("registrato") = solo dati con data <= oggi (Europe/Rome) e, per
//   i giri, solo quelli CONFERMATI. Le bozze sono esposte a parte.
// - Prese effettuate = prese distinte presenti nei giri confermati del periodo,
//   indipendentemente dalla loro data presa (le arretrate contano nel giorno
//   del giro che le ha eseguite).
// - Forecast = registrato + per ogni giorno lavorativo rimanente: il dato già
//   pianificato se il giorno ne ha, altrimenti la media per giorno lavorativo
//   trascorso. Un giorno è o pianificato o proiettato, mai entrambi.

import type { PickupStatus, RouteShift, RouteStatus } from "@prisma/client";
import {
  computeCostBreakdown,
  draftRoutesCost,
  type CostBreakdown,
  type DriverCompanyKey,
} from "@/lib/costs";
import { pickupPalletEquivalent } from "@/lib/warnings";
import { parseDateOnly, toDateInputValue } from "@/lib/dates";

export { computeCostBreakdown };

// Limiti teorici giornalieri per il controllo km autisti.
export const KM_LIMIT_PER_DAY = { BILICO: 300, MOTRICE: 250 } as const;
export const DEFAULT_KM_LIMIT = 300;

type CalcPickup = {
  id: string;
  pickupDate: Date;
  status: PickupStatus;
  pallets: number | null;
  loadingMeters: number | null;
  taxableVolumeM3: number | null;
  customerId: string;
  customer: { name: string };
};

export type MonthlyInput = {
  month: string; // "YYYY-MM" già validato
  today: string; // "YYYY-MM-DD" a Roma
  /** Giri del mese, tutti gli stati (anche futuri). */
  routes: {
    id: string;
    routeDate: Date;
    status: RouteStatus;
    shift: RouteShift;
    km: number | null;
    vehicleId: string | null;
    driverId: string | null;
    vehicle: { dailyCost: number | null; costPerKm: number | null } | null;
    driver: { id: string; name: string; company: DriverCompanyKey } | null;
    stops: { pickup: CalcPickup | null }[];
  }[];
  /** Prese con data presa nel mese (per le non assegnate). */
  monthPickups: (CalcPickup & { inConfirmedRoute: boolean })[];
  tractions: { tractionDate: Date; cost: number | null; km: number | null; driverId: string | null }[];
  carichi: { loadDate: Date; nolo: number | null }[];
  /** Autisti della filiale (anche disattivati: compaiono se hanno km nel mese). */
  drivers: { id: string; name: string; active: boolean; defaultVehicle: { vehicleType: string } | null }[];
};

export type KmRow = {
  id: string;
  name: string;
  dailyLimit: number;
  monthlyLimit: number;
  km: number;
  pct: number;
};

export type MonthlyStats = {
  month: string;
  today: string;
  // --- consuntivo (fino a oggi) ---
  pickupsCount: number;
  volumeM3: number;
  /** Pallet equivalenti (pallet dichiarati o MTL × 2,5). */
  pallets: number;
  routesCount: number;
  vehiclesUsed: number;
  unassignedPickups: number;
  costs: CostBreakdown;
  draftRoutesCount: number;
  draftCost: number;
  // --- medie per giorno con operatività (fino a oggi) ---
  operativeDays: number;
  avgVehiclesPerDay: number;
  avgPickupsPerDay: number;
  avgVolumePerDay: number;
  avgCostPerDay: number;
  // --- forecast a fine mese ---
  workdaysTotal: number;
  workdaysElapsed: number;
  workdaysRemaining: number;
  /** Giorni lavorativi rimanenti già coperti da giri confermati. */
  plannedWorkdays: number;
  projectedPickups: number;
  projectedVolume: number;
  projectedCosts: Pick<CostBreakdown, "raccolta" | "nonClassificato" | "trazioni" | "noli" | "total">;
  // --- classifiche ---
  topCustomer: { name: string; count: number; volume: number } | null;
  topDriver: { name: string; pickups: number; routes: number } | null;
  // --- controllo km autisti ---
  kmRows: KmRow[];
};

/** Giorni lavorativi (lun-ven) tra due date incluse. */
export function workdaysBetween(start: Date, end: Date): number {
  return workdayKeys(start, end).length;
}

function workdayKeys(start: Date, end: Date): string[] {
  const out: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) out.push(toDateInputValue(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const DAY_MS = 86_400_000;

/**
 * Proiezione a fine mese di una grandezza: registrato + per ogni giorno
 * lavorativo rimanente il valore pianificato (se c'è) o la media; i giorni non
 * lavorativi già pianificati (es. sabato) si sommano così come sono.
 */
function project(
  registered: number,
  workdaysElapsed: number,
  remainingDays: string[],
  plannedByDay: Map<string, number>,
): number {
  const rate = workdaysElapsed > 0 ? registered / workdaysElapsed : 0;
  const remaining = new Set(remainingDays);
  let total = registered;
  for (const day of remainingDays) total += plannedByDay.get(day) ?? rate;
  for (const [day, v] of plannedByDay) if (!remaining.has(day)) total += v;
  return total;
}

const addTo = (m: Map<string, number>, key: string, v: number) => m.set(key, (m.get(key) ?? 0) + v);

export function computeMonthlyStats(input: MonthlyInput): MonthlyStats {
  const [year, mon] = input.month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 0));
  const todayDate = parseDateOnly(input.today);
  const inMonth = (d: Date) => d >= monthStart && d <= monthEnd;
  const isPast = (d: Date) => d <= todayDate; // oggi compreso

  const monthRoutes = input.routes.filter((r) => inMonth(r.routeDate));
  const confirmed = monthRoutes.filter((r) => r.status === "CONFIRMED");
  const pastRoutes = confirmed.filter((r) => isPast(r.routeDate));
  const futureRoutes = confirmed.filter((r) => !isPast(r.routeDate));
  const drafts = monthRoutes.filter((r) => r.status === "DRAFT");
  const monthTractions = input.tractions.filter((t) => inMonth(t.tractionDate));
  const pastTractions = monthTractions.filter((t) => isPast(t.tractionDate));
  const monthCarichi = input.carichi.filter((c) => inMonth(c.loadDate));
  const pastCarichi = monthCarichi.filter((c) => isPast(c.loadDate));

  // --- Prese effettuate: distinte, dai giri confermati fino a oggi ---
  const executed = new Map<string, CalcPickup>();
  for (const r of [...pastRoutes].sort((a, b) => a.routeDate.getTime() - b.routeDate.getTime())) {
    for (const s of r.stops) {
      if (!s.pickup || s.pickup.status === "CANCELLED" || executed.has(s.pickup.id)) continue;
      executed.set(s.pickup.id, s.pickup);
    }
  }
  const executedList = [...executed.values()];
  const pickupsCount = executedList.length;
  const volumeM3 = executedList.reduce((s, p) => s + (p.taxableVolumeM3 ?? 0), 0);
  const pallets = executedList.reduce((s, p) => s + pickupPalletEquivalent(p), 0);

  // --- Costi a consuntivo ---
  const costs = computeCostBreakdown({ routes: pastRoutes, tractions: pastTractions, carichi: pastCarichi });

  // --- Mezzi e giorni con operatività (fino a oggi) ---
  const vehiclesByDay = new Map<string, Set<string>>();
  const allVehicles = new Set<string>();
  const operativeDaySet = new Set<string>();
  for (const r of pastRoutes) {
    const day = toDateInputValue(r.routeDate);
    operativeDaySet.add(day);
    if (r.vehicleId) {
      if (!vehiclesByDay.has(day)) vehiclesByDay.set(day, new Set());
      vehiclesByDay.get(day)!.add(r.vehicleId);
      allVehicles.add(r.vehicleId);
    }
  }
  for (const t of pastTractions) operativeDaySet.add(toDateInputValue(t.tractionDate));
  for (const c of pastCarichi) operativeDaySet.add(toDateInputValue(c.loadDate));
  const operativeDays = operativeDaySet.size;
  const avg = (total: number, n: number) => (n > 0 ? total / n : 0);
  const vehicleDays = [...vehiclesByDay.values()].reduce((s, set) => s + set.size, 0);

  // --- Prese non assegnate: data presa fino a oggi, non annullate, senza giro confermato ---
  const unassignedPickups = input.monthPickups.filter(
    (p) => inMonth(p.pickupDate) && isPast(p.pickupDate) && p.status !== "CANCELLED" && !p.inConfirmedRoute,
  ).length;

  // --- Forecast ---
  const workdaysTotal = workdaysBetween(monthStart, monthEnd);
  const elapsedEnd = todayDate < monthEnd ? todayDate : monthEnd;
  const workdaysElapsed = todayDate < monthStart ? 0 : workdaysBetween(monthStart, elapsedEnd);
  const remainingStart = todayDate < monthStart ? monthStart : new Date(todayDate.getTime() + DAY_MS);
  const remainingDays = workdayKeys(remainingStart, monthEnd);

  // Pianificato per giorno (solo date future): prese/volumi/raccolta dai giri
  // confermati, trazioni e noli dai rispettivi registri.
  const plannedPickups = new Map<string, number>();
  const plannedRaccolta = new Map<string, number>();
  const plannedNonClass = new Map<string, number>();
  const plannedSeen = new Set(executed.keys());
  for (const r of futureRoutes) {
    const day = toDateInputValue(r.routeDate);
    const c = computeCostBreakdown({ routes: [r], tractions: [], carichi: [] });
    addTo(plannedRaccolta, day, c.raccolta);
    addTo(plannedNonClass, day, c.nonClassificato);
    addTo(plannedPickups, day, 0);
    for (const s of r.stops) {
      if (!s.pickup || s.pickup.status === "CANCELLED" || plannedSeen.has(s.pickup.id)) continue;
      plannedSeen.add(s.pickup.id);
      addTo(plannedPickups, day, 1);
    }
  }
  // Volume tassabile non ancora noto per il futuro: stima = prese pianificate ×
  // volume medio per presa eseguita.
  const volumePerPickup = avg(volumeM3, pickupsCount);
  const plannedVolume = new Map([...plannedPickups].map(([day, n]) => [day, n * volumePerPickup]));
  const plannedTrazioni = new Map<string, number>();
  for (const t of monthTractions) {
    if (!isPast(t.tractionDate)) addTo(plannedTrazioni, toDateInputValue(t.tractionDate), t.cost ?? 0);
  }
  const plannedNoli = new Map<string, number>();
  for (const c of monthCarichi) {
    if (!isPast(c.loadDate)) addTo(plannedNoli, toDateInputValue(c.loadDate), c.nolo ?? 0);
  }

  const proj = (registered: number, planned: Map<string, number>) =>
    project(registered, workdaysElapsed, remainingDays, planned);
  const projectedCosts = {
    raccolta: proj(costs.raccolta, plannedRaccolta),
    nonClassificato: proj(costs.nonClassificato, plannedNonClass),
    trazioni: proj(costs.trazioni, plannedTrazioni),
    noli: proj(costs.noli, plannedNoli),
    total: 0,
  };
  projectedCosts.total =
    projectedCosts.raccolta + projectedCosts.nonClassificato + projectedCosts.trazioni + projectedCosts.noli;

  // --- Top cliente (prese eseguite, spareggio sul volume) ---
  const byCustomer = new Map<string, { name: string; count: number; volume: number }>();
  for (const p of executedList) {
    const entry = byCustomer.get(p.customerId) ?? { name: p.customer.name, count: 0, volume: 0 };
    entry.count += 1;
    entry.volume += p.taxableVolumeM3 ?? 0;
    byCustomer.set(p.customerId, entry);
  }
  const topCustomer =
    [...byCustomer.values()].sort((a, b) => b.count - a.count || b.volume - a.volume)[0] ?? null;

  // --- Top autista (prese nei suoi giri confermati, spareggio sui giri) ---
  const byDriver = new Map<string, { name: string; pickups: number; routes: number }>();
  for (const r of pastRoutes) {
    if (!r.driver) continue;
    const entry = byDriver.get(r.driver.id) ?? { name: r.driver.name, pickups: 0, routes: 0 };
    entry.pickups += r.stops.filter((s) => s.pickup != null).length;
    entry.routes += 1;
    byDriver.set(r.driver.id, entry);
  }
  const topDriver =
    [...byDriver.values()].sort((a, b) => b.pickups - a.pickups || b.routes - a.routes)[0] ?? null;

  // --- Km autisti (giri confermati + trazioni, fino a oggi) ---
  const kmByDriver = new Map<string, number>();
  for (const r of pastRoutes) if (r.driverId && r.km != null) addTo(kmByDriver, r.driverId, r.km);
  for (const t of pastTractions) if (t.driverId && t.km != null) addTo(kmByDriver, t.driverId, t.km);
  const kmRows: KmRow[] = input.drivers
    .filter((d) => d.active || (kmByDriver.get(d.id) ?? 0) > 0)
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

  return {
    month: input.month,
    today: input.today,
    pickupsCount,
    volumeM3,
    pallets,
    routesCount: pastRoutes.length,
    vehiclesUsed: allVehicles.size,
    unassignedPickups,
    costs,
    draftRoutesCount: drafts.length,
    draftCost: draftRoutesCost(drafts),
    operativeDays,
    avgVehiclesPerDay: avg(vehicleDays, operativeDays),
    avgPickupsPerDay: avg(pickupsCount, operativeDays),
    avgVolumePerDay: avg(volumeM3, operativeDays),
    avgCostPerDay: avg(costs.total, operativeDays),
    workdaysTotal,
    workdaysElapsed,
    workdaysRemaining: remainingDays.length,
    plannedWorkdays: remainingDays.filter((day) => plannedPickups.has(day)).length,
    projectedPickups: proj(pickupsCount, plannedPickups),
    projectedVolume: proj(volumeM3, plannedVolume),
    projectedCosts,
    topCustomer,
    topDriver,
    kmRows,
  };
}
