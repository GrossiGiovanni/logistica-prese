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
 * Carico = trazione INDUSTRIALE se fatto da Eurosarda: autista con azienda
 * Eurosarda, oppure vettore marcato "Eurosarda" in anagrafica trazionisti.
 * Tutti gli altri carichi sono noli esterni. I Carichi sono l'unica fonte delle
 * trazioni: non esiste più una gestione separata (niente doppi conteggi).
 */
export type CaricoCostInput = {
  nolo: number | null;
  driver?: { company: DriverCompanyKey } | null;
  trazionista?: { isEurosarda: boolean } | null;
};

export function isIndustrialCarico(c: Omit<CaricoCostInput, "nolo">): boolean {
  return c.driver?.company === "EUROSARDA" || c.trazionista?.isEurosarda === true;
}

/**
 * Ripartizione dei costi per voce.
 * - rama / omar / industrialeRitiri: costo dei giri CONFERMATI, per azienda
 *   dell'autista (non per nome né per il vecchio flag Eurosarda).
 * - raccolta = rama + omar + industrialeRitiri.
 * - nonClassificato: giri confermati senza autista o con azienda "Altro":
 *   fuori dalla raccolta ma nel totale, da sistemare in anagrafica.
 * - trazioniIndustriali: noli dei carichi fatti da Eurosarda.
 * - industriale = industrialeRitiri + trazioniIndustriali (Costo Industriale).
 * - noliEsterni: noli dei carichi degli altri vettori, voce separata.
 * - total = raccolta + nonClassificato + trazioniIndustriali + noliEsterni
 *         = rama + omar + industriale + noliEsterni + nonClassificato.
 * I giri in bozza sono esclusi (vedi draftRoutesCost).
 */
export type CostBreakdown = {
  rama: number;
  omar: number;
  industrialeRitiri: number;
  raccolta: number;
  nonClassificato: number;
  trazioniIndustriali: number;
  industriale: number;
  noliEsterni: number;
  total: number;
};

export function emptyCostBreakdown(): CostBreakdown {
  return {
    rama: 0,
    omar: 0,
    industrialeRitiri: 0,
    raccolta: 0,
    nonClassificato: 0,
    trazioniIndustriali: 0,
    industriale: 0,
    noliEsterni: 0,
    total: 0,
  };
}

export function computeCostBreakdown(args: { routes: CostRouteInput[]; carichi: CaricoCostInput[] }): CostBreakdown {
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
  for (const c of args.carichi) {
    if (isIndustrialCarico(c)) out.trazioniIndustriali += c.nolo ?? 0;
    else out.noliEsterni += c.nolo ?? 0;
  }
  out.raccolta = out.rama + out.omar + out.industrialeRitiri;
  out.industriale = out.industrialeRitiri + out.trazioniIndustriali;
  out.total = out.raccolta + out.nonClassificato + out.trazioniIndustriali + out.noliEsterni;
  return out;
}

/**
 * Voci di costo da mostrare (Home, report giornaliero e mensile, export).
 * Sono ADDITIVE: la loro somma è esattamente il totale (collaudato nei test).
 * La raccolta e il totale si mostrano a parte, come riepilogo.
 */
export type CostLine = { key: string; label: string; value: number; hint: string };

export function costLines(c: CostBreakdown): CostLine[] {
  const eur = (v: number) => formatEuro(Math.round(v));
  const lines: CostLine[] = [
    { key: "rama", label: "Rama Trasporti", value: c.rama, hint: "Ritiri" },
    { key: "omar", label: "Omar Trasporti", value: c.omar, hint: "Ritiri" },
    {
      key: "industriale",
      label: "Costo Industriale",
      value: c.industriale,
      hint: `Ritiri ${eur(c.industrialeRitiri)} + trazioni Eurosarda ${eur(c.trazioniIndustriali)}`,
    },
    { key: "noli-esterni", label: "Noli esterni", value: c.noliEsterni, hint: "Carichi di altri vettori" },
  ];
  if (c.nonClassificato > 0) {
    lines.push({
      key: "non-classificato",
      label: "Non classificato",
      value: c.nonClassificato,
      hint: "Giri senza autista o con azienda «Altro»: verificare l'anagrafica",
    });
  }
  return lines;
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
