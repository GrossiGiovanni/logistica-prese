// Calcolo dei costi di un giro.
// Costo = quota fissa giornaliera del mezzo (intera o metà a seconda della fascia)
//         + km percorsi × tariffa al km.
//
// Riferimenti cliente: BILICO 400€/giorno, MOTRICE 300€/giorno
// (200+200 / 150+150, cioè metà per la sola mattina o il solo pomeriggio).

import type { Vehicle, Route, RouteShift } from "@prisma/client";

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

/**
 * Ripartizione dei costi tra "industriale" e "padroncini".
 * Industriale = costi degli autisti marcati come tali in anagrafica
 * (flag separati per giri e trazioni). Padroncini = tutto il resto dei costi
 * esterni: calcolato come differenza dal totale, così non ci sono doppi conteggi.
 */
export type CostSplit = { industrial: number; padroncini: number; total: number };

export function splitCosts(args: {
  routes: { cost: number; industrial: boolean }[];
  tractions: { cost: number; industrial: boolean }[];
  /** Altri costi esterni (es. noli dei carichi): sempre lato padroncini. */
  otherExternal?: number;
}): CostSplit {
  const sum = (xs: { cost: number }[]) => xs.reduce((s, x) => s + x.cost, 0);
  const industrial =
    sum(args.routes.filter((r) => r.industrial)) +
    sum(args.tractions.filter((t) => t.industrial));
  const total = sum(args.routes) + sum(args.tractions) + (args.otherExternal ?? 0);
  return { industrial, padroncini: total - industrial, total };
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
