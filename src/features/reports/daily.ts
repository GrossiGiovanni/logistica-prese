// Costi della singola giornata, per voce (Rama / Omar / Industriale ritiri /
// trazioni / noli). Usa la stessa funzione del mensile (computeCostBreakdown),
// così la somma dei giorni coincide con il mese.

import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";
import { computeCostBreakdown, draftRoutesCost, type CostBreakdown } from "@/lib/costs";

export type DailyCosts = CostBreakdown & { draftCost: number };

/** Costi del giorno: giri confermati + trazioni + noli; le bozze a parte. */
export async function getDailyCosts(branchId: string, dateStr: string): Promise<DailyCosts> {
  const date = parseDateOnly(dateStr);

  const [routes, tractions, carichi] = await Promise.all([
    prisma.route.findMany({
      where: { branchId, routeDate: date },
      select: {
        status: true,
        shift: true,
        km: true,
        vehicle: { select: { dailyCost: true, costPerKm: true } },
        driver: { select: { company: true } },
      },
    }),
    prisma.traction.findMany({ where: { branchId, tractionDate: date }, select: { cost: true } }),
    prisma.carico.findMany({ where: { branchId, loadDate: date }, select: { nolo: true } }),
  ]);

  return {
    ...computeCostBreakdown({ routes, tractions, carichi }),
    draftCost: draftRoutesCost(routes),
  };
}
