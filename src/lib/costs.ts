// Calcolo dei costi di un giro.
// Costo = quota fissa giornaliera del mezzo (intera o metà a seconda della fascia)
//         + km percorsi × tariffa al km.
//
// Riferimenti cliente: BILICO 400€/giorno, MOTRICE 300€/giorno
// (200+200 / 150+150, cioè metà per la sola mattina o il solo pomeriggio).

import type { Vehicle, Route, RouteShift, RouteStatus } from "@prisma/client";

type RouteCostInput = Pick<Route, "shift" | "km"> & {
  vehicle: Pick<Vehicle, "dailyCost" | "costPerKm"> | null;
};

/** Frazione della quota fissa giornaliera in base alla fascia del giro. */
export function shiftFraction(shift: RouteShift): number {
  return shift === "FULL_DAY" ? 1 : 0.5;
}

/** Quota fissa del giro (mezzo) in base alla fascia. Null se il mezzo non ha un costo. */
export function routeFixedCost(route: RouteCostInput): number | null {
  const daily = route.vehicle?.dailyCost;
  if (daily == null) return null;
  return daily * shiftFraction(route.shift);
}

/** Costo dei km percorsi. Null se mancano km o tariffa. */
export function routeKmCost(route: RouteCostInput): number | null {
  const rate = route.vehicle?.costPerKm;
  if (rate == null || route.km == null) return null;
  return rate * route.km;
}

/** Costo totale del giro (fisso + km). Null se non c'è alcuna componente calcolabile. */
export function routeTotalCost(route: RouteCostInput): number | null {
  const fixed = routeFixedCost(route);
  const km = routeKmCost(route);
  if (fixed == null && km == null) return null;
  return (fixed ?? 0) + (km ?? 0);
}

/** Azienda dell'autista (stessi valori dell'enum Prisma DriverCompany). */
export type DriverCompanyKey = "EUROSARDA" | "RAMA" | "OMAR" | "ALTRO";

export const driverCompanyLabels: Record<DriverCompanyKey, string> = {
  EUROSARDA: "Eurosarda",
  RAMA: "Rama Trasporti",
  OMAR: "Omar Trasporti",
  ALTRO: "Altro / non classificato",
};

type CostRouteInput = RouteCostInput & {
  status: RouteStatus;
  driver: { company: DriverCompanyKey } | null;
};

/**
 * Ripartizione dei costi per voce.
 * - rama / omar / industrialeRitiri: costo dei giri CONFERMATI, per azienda
 *   dell'autista (non per nome né per il vecchio flag Eurosarda).
 * - raccolta = rama + omar + industrialeRitiri.
 * - nonClassificato: giri confermati senza autista o con azienda "Altro":
 *   fuori dalla raccolta ma nel totale, da sistemare in anagrafica.
 * - trazioni e noli: voci separate, mai nella raccolta.
 * I giri in bozza sono esclusi (vedi draftRoutesCost).
 */
export type CostBreakdown = {
  rama: number;
  omar: number;
  industrialeRitiri: number;
  raccolta: number;
  nonClassificato: number;
  trazioni: number;
  noli: number;
  total: number;
};

export function emptyCostBreakdown(): CostBreakdown {
  return { rama: 0, omar: 0, industrialeRitiri: 0, raccolta: 0, nonClassificato: 0, trazioni: 0, noli: 0, total: 0 };
}

export function computeCostBreakdown(args: {
  routes: CostRouteInput[];
  tractions: { cost: number | null }[];
  carichi: { nolo: number | null }[];
}): CostBreakdown {
  const out = emptyCostBreakdown();
  for (const r of args.routes) {
    if (r.status !== "CONFIRMED") continue;
    const cost = routeTotalCost(r) ?? 0;
    switch (r.driver?.company) {
      case "RAMA":
        out.rama += cost;
        break;
      case "OMAR":
        out.omar += cost;
        break;
      case "EUROSARDA":
        out.industrialeRitiri += cost;
        break;
      default:
        out.nonClassificato += cost;
    }
  }
  out.trazioni = args.tractions.reduce((s, t) => s + (t.cost ?? 0), 0);
  out.noli = args.carichi.reduce((s, c) => s + (c.nolo ?? 0), 0);
  out.raccolta = out.rama + out.omar + out.industrialeRitiri;
  out.total = out.raccolta + out.nonClassificato + out.trazioni + out.noli;
  return out;
}

/** Costo dei giri ancora in bozza (escluso dal consuntivo, mostrato a parte). */
export function draftRoutesCost(routes: CostRouteInput[]): number {
  return routes
    .filter((r) => r.status === "DRAFT")
    .reduce((s, r) => s + (routeTotalCost(r) ?? 0), 0);
}

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Formatta un importo in euro (es. "400 €"), o "—" se null. */
export function formatEuro(value: number | null | undefined): string {
  if (value == null) return "—";
  return euro.format(value);
}
