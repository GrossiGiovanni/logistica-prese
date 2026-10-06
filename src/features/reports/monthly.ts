// Statistiche mensili di filiale (consuntivo + forecast), condivise tra la
// Home Dashboard e il Report mensile per NON duplicare la business logic.
// Qui si caricano i dati; i calcoli sono in monthly-calc.ts (puri e testati).

import { prisma } from "@/lib/db";
import { routeInclude } from "@/features/routes/queries";
import { normalizeMonth, todayInputValue } from "@/lib/dates";
import { computeMonthlyStats, type MonthlyStats } from "./monthly-calc";
import { caricoCostSelect } from "./daily";

export { KM_LIMIT_PER_DAY, DEFAULT_KM_LIMIT, workdaysBetween } from "./monthly-calc";
export type { KmRow, MonthlyStats } from "./monthly-calc";
export { normalizeMonth };

export type MonthlyReport = MonthlyStats & { monthLabel: string };

/**
 * Calcola tutte le statistiche mensili della filiale per il mese "YYYY-MM"
 * (non valido → mese corrente a Roma).
 */
export async function getMonthlyStats(branchId: string, month?: string): Promise<MonthlyReport> {
  const selectedMonth = normalizeMonth(month);
  const [year, mon] = selectedMonth.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 0));
  const range = { gte: monthStart, lte: monthEnd };

  const [routes, monthPickups, drivers, carichi] = await Promise.all([
    // Tutti gli stati e anche i giorni futuri: il calcolo separa consuntivo,
    // bozze e pianificato.
    prisma.route.findMany({ where: { branchId, routeDate: range }, include: routeInclude }),
    prisma.pickup.findMany({
      where: { branchId, pickupDate: range },
      select: {
        id: true,
        pickupDate: true,
        cancelledAt: true,
        pallets: true,
        loadingMeters: true,
        taxableVolumeM3: true,
        customerId: true,
        customer: { select: { name: true } },
        routeStops: { where: { route: { status: "CONFIRMED" } }, select: { id: true }, take: 1 },
      },
    }),
    prisma.driver.findMany({
      where: { branchId },
      select: { id: true, name: true, active: true, defaultVehicle: { select: { vehicleType: true } } },
      orderBy: { name: "asc" },
    }),
    // Carichi: unica fonte di trazioni (industriali) e noli esterni.
    prisma.carico.findMany({ where: { branchId, loadDate: range }, select: caricoCostSelect }),
  ]);

  const stats = computeMonthlyStats({
    month: selectedMonth,
    today: todayInputValue(),
    routes,
    monthPickups: monthPickups.map(({ routeStops, ...p }) => ({ ...p, inConfirmedRoute: routeStops.length > 0 })),
    carichi,
    drivers,
  });

  const monthLabel = monthStart.toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
  return { ...stats, monthLabel };
}
