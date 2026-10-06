// Costi della singola giornata, per voce (Rama / Omar / Costo Industriale =
// ritiri Eurosarda + trazioni Eurosarda dai Carichi / noli esterni). Usa la
// stessa funzione del mensile (computeCostBreakdown), così la somma dei giorni
// coincide con il mese.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";
import { computeCostBreakdown, draftRoutesCost, type CostBreakdown } from "@/lib/costs";

/** Campi del carico che servono a classificarne il nolo (industriale / esterno). */
export const caricoCostSelect = {
  loadDate: true,
  nolo: true,
  driver: { select: { company: true } },
  trazionista: { select: { isEurosarda: true } },
} satisfies Prisma.CaricoSelect;

/** Campi del giro che servono al suo costo e alla sua voce (azienda autista). */
export const routeCostSelect = {
  status: true,
  shift: true,
  km: true,
  vehicle: { select: { dailyCost: true, costPerKm: true } },
  driver: { select: { company: true } },
} satisfies Prisma.RouteSelect;

export type DailyCosts = CostBreakdown & { draftCost: number };

/** Costi del giorno: giri confermati + noli dei carichi; le bozze a parte. */
export async function getDailyCosts(branchId: string, dateStr: string): Promise<DailyCosts> {
  const date = parseDateOnly(dateStr);

  const [routes, carichi] = await Promise.all([
    prisma.route.findMany({ where: { branchId, routeDate: date }, select: routeCostSelect }),
    prisma.carico.findMany({ where: { branchId, loadDate: date }, select: caricoCostSelect }),
  ]);

  return {
    ...computeCostBreakdown({ routes, carichi }),
    draftCost: draftRoutesCost(routes),
  };
}
