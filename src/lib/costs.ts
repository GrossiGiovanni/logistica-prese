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
