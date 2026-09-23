// Costi della singola giornata, ripartiti tra padroncini e industriale.
// Usa la stessa logica del mensile (routeTotalCost + splitCosts), così i due
// livelli non possono divergere.

import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";
import { routeTotalCost, splitCosts, type CostSplit } from "@/lib/costs";

/** Ripartizione costi del giorno: giri + trazioni + noli dei carichi. */
export async function getDailyCostSplit(branchId: string, dateStr: string): Promise<CostSplit> {
  const date = parseDateOnly(dateStr);

  const [routes, tractions, carichi] = await Promise.all([
    prisma.route.findMany({
      where: { branchId, routeDate: date },
      select: {
        shift: true,
        km: true,
        vehicle: { select: { dailyCost: true, costPerKm: true } },
        driver: { select: { industrialRoutes: true } },
      },
    }),
    prisma.traction.findMany({
      where: { branchId, tractionDate: date },
      select: { cost: true, driver: { select: { industrialTractions: true } } },
    }),
    prisma.carico.findMany({
      where: { branchId, loadDate: date },
      select: { nolo: true },
    }),
  ]);

  return splitCosts({
    routes: routes.map((r) => ({
      cost: routeTotalCost(r) ?? 0,
      industrial: r.driver?.industrialRoutes ?? false,
    })),
    tractions: tractions.map((t) => ({
      cost: t.cost ?? 0,
      industrial: t.driver?.industrialTractions ?? false,
    })),
    otherExternal: carichi.reduce((s, c) => s + (c.nolo ?? 0), 0),
  });
}
