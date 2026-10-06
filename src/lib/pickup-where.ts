// Filtri Prisma equivalenti alle regole PURE di pickup-status.ts.
// Ogni pagina usa questi (mai condizioni scritte a mano), così lista prese,
// KPI e filtri applicano esattamente la stessa regola.

import type { Prisma } from "@prisma/client";
import type { PickupOperationalStatus } from "./pickup-status";
import { parseDateOnly } from "./dates";

/** Prese non annullate (l'unico stato persistito è l'annullamento). */
export const NOT_CANCELLED = { cancelledAt: null } satisfies Prisma.PickupWhereInput;

const HAS_LOAD: Prisma.PickupWhereInput = {
  OR: [{ pallets: { not: null } }, { loadingMeters: { not: null } }, { volumeM3: { not: null } }],
};
const NO_LOAD: Prisma.PickupWhereInput = { pallets: null, loadingMeters: null, volumeM3: null };

/** Equivalente Prisma di pickupOperationalStatus(p) === status. */
export function pickupStatusWhere(status: PickupOperationalStatus): Prisma.PickupWhereInput {
  switch (status) {
    case "ANNULLATA":
      return { cancelledAt: { not: null } };
    case "PIANIFICATA":
      return { cancelledAt: null, routeStops: { some: {} } };
    case "PRONTA":
      return { AND: [{ cancelledAt: null, routeStops: { none: {} } }, HAS_LOAD] };
    case "DA_COMPLETARE":
      return { cancelledAt: null, routeStops: { none: {} }, ...NO_LOAD };
  }
}

/**
 * Equivalente Prisma di isUnassignedOn(p, date): prese non annullate, non in un
 * giro, con data fino al giorno indicato (inclusi i recuperi dei giorni prima).
 */
export function unassignedPickupsWhere(branchId: string, date: string): Prisma.PickupWhereInput {
  return {
    branchId,
    cancelledAt: null,
    routeStops: { none: {} },
    pickupDate: { lte: parseDateOnly(date) },
  };
}

/** Aggiunge una condizione in AND senza sovrascrivere eventuali OR già presenti. */
export function andWhere(base: Prisma.PickupWhereInput, extra: Prisma.PickupWhereInput): Prisma.PickupWhereInput {
  const prev = base.AND ? (Array.isArray(base.AND) ? base.AND : [base.AND]) : [];
  return { ...base, AND: [...prev, extra] };
}
