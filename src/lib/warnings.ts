// Logica centralizzata per il calcolo dei warning su prese e giri.
// Usata sia lato server (generazione, KPI) sia lato UI (badge).

import type { Pickup, Vehicle, Driver, RouteStop, Route, RouteShift, TimeWindow } from "@prisma/client";

export type PickupWarning =
  | "missing_pallets"
  | "missing_notes"
  | "high_priority"
  | "requires_motrice"
  | "requires_tail_lift";

export type RouteWarning =
  | "vehicle_missing"
  | "driver_missing"
  | "capacity_exceeded"
  | "contains_unvalidated_pickups"
  | "pickup_shift_mismatch"
  | "vehicle_unavailable"
  | "motrice_required"
  | "tail_lift_required"
  | "driver_busy"
  | "vehicle_busy";

// ---------------------------------------------------------------------------
// Compatibilità fasce (mattina / pomeriggio / giornata intera)
// ---------------------------------------------------------------------------

/** True se il mezzo (sua disponibilità) può coprire la fascia del giro. */
export function vehicleCovers(availability: RouteShift, shift: RouteShift): boolean {
  return availability === "FULL_DAY" || availability === shift;
}

/** True se la fascia della presa è compatibile con la fascia del giro. */
export function pickupFitsShift(timeWindow: TimeWindow, shift: RouteShift): boolean {
  if (shift === "FULL_DAY") return true; // un giro a giornata intera accetta tutto
  if (timeWindow === "MORNING") return shift === "MORNING";
  if (timeWindow === "AFTERNOON") return shift === "AFTERNOON";
  return true; // ANYTIME / SPECIFIC: indifferente
}

/** True se due fasce si sovrappongono (mattina e pomeriggio NON si sovrappongono). */
export function shiftsOverlap(a: RouteShift, b: RouteShift): boolean {
  return a === "FULL_DAY" || b === "FULL_DAY" || a === b;
}

export const pickupWarningLabels: Record<PickupWarning, string> = {
  missing_pallets: "Carico mancante",
  missing_notes: "Note mancanti",
  high_priority: "Priorità alta",
  requires_motrice: "Richiede motrice",
  requires_tail_lift: "Richiede sponda",
};

export const routeWarningLabels: Record<RouteWarning, string> = {
  vehicle_missing: "Mezzo mancante",
  driver_missing: "Autista mancante",
  capacity_exceeded: "Capacità superata",
  contains_unvalidated_pickups: "Prese con dati mancanti",
  pickup_shift_mismatch: "Presa in fascia diversa dal giro",
  vehicle_unavailable: "Mezzo non disponibile in questa fascia",
  motrice_required: "Presa richiede motrice: mezzo non compatibile",
  tail_lift_required: "Presa richiede sponda: mezzo senza sponda",
  driver_busy: "Autista già impegnato",
  vehicle_busy: "Mezzo già impegnato",
};

// Tono del badge: rosso per criticità bloccanti, giallo per avvisi.
export const pickupWarningTone: Record<PickupWarning, "red" | "amber" | "blue"> = {
  missing_pallets: "amber",
  missing_notes: "amber",
  high_priority: "blue",
  requires_motrice: "blue",
  requires_tail_lift: "blue",
};

export const routeWarningTone: Record<RouteWarning, "red" | "amber" | "blue"> = {
  vehicle_missing: "amber",
  driver_missing: "amber",
  capacity_exceeded: "red",
  contains_unvalidated_pickups: "amber",
  pickup_shift_mismatch: "red",
  vehicle_unavailable: "red",
  motrice_required: "red",
  tail_lift_required: "red",
  driver_busy: "red",
  vehicle_busy: "red",
};

type PickupLike = Pick<
  Pickup,
  | "pallets"
  | "addressId"
  | "timeWindow"
  | "rawNotes"
  | "internalNotes"
  | "weightKg"
  | "volumeM3"
  | "loadingMeters"
  | "colli"
  | "priority"
  | "requiresMotrice"
  | "requiresTailLift"
>;

/** True se la presa ha un dato di carico utilizzabile (pallet, metri lineari o m³). */
export function hasLoadData(pickup: Pick<Pickup, "pallets" | "loadingMeters" | "volumeM3">): boolean {
  return pickup.pallets != null || pickup.loadingMeters != null || pickup.volumeM3 != null;
}

/**
 * Una presa è "con dati mancanti" se non ha indirizzo, fascia o alcun dato di
 * carico (pallet, MTL e m³ sono equivalenti tra loro: ne basta uno).
 */
export function hasMissingData(pickup: PickupLike): boolean {
  if (!pickup.addressId) return true;
  if (!pickup.timeWindow) return true;
  return !hasLoadData(pickup);
}

/** Lista dei warning applicabili a una presa. */
export function getPickupWarnings(pickup: PickupLike): PickupWarning[] {
  const warnings: PickupWarning[] = [];

  if (!hasLoadData(pickup)) warnings.push("missing_pallets");

  const hasRawNotes = Boolean(pickup.rawNotes && pickup.rawNotes.trim().length > 0);
  const hasInternalNotes = Boolean(
    pickup.internalNotes && pickup.internalNotes.trim().length > 0,
  );
  if (!hasRawNotes && !hasInternalNotes) warnings.push("missing_notes");

  if (pickup.priority === "HIGH" || pickup.priority === "MANDATORY") {
    warnings.push("high_priority");
  }
  if (pickup.requiresMotrice) warnings.push("requires_motrice");
  if (pickup.requiresTailLift) warnings.push("requires_tail_lift");

  return warnings;
}

type RouteWithRelations = Route & {
  vehicle: Vehicle | null;
  driver: Driver | null;
  // Una fermata è una presa (ritiro) oppure un reso (pickup null).
  stops: (RouteStop & { pickup: PickupLike | null })[];
};

/** Solo le prese (ritiri) del giro: i resi non entrano nei totali di carico. */
function routePickups(route: RouteWithRelations): PickupLike[] {
  return route.stops
    .map((s) => s.pickup)
    .filter((p): p is PickupLike => p != null);
}

/**
 * Pallet-equivalenti di una presa: usa i pallet se presenti, altrimenti li ricava
 * dai metri lineari (MTL × 2,5). Un solo valore, così non c'è doppio conteggio.
 * Es. 4 MTL → 10 pallet.
 */
export function pickupPalletEquivalent(p: {
  pallets: number | null;
  loadingMeters: number | null;
}): number {
  if (p.pallets != null) return p.pallets;
  if (p.loadingMeters != null) return p.loadingMeters * PALLETS_PER_METER;
  return 0;
}

/** Metri lineari-equivalenti di una presa (dal valore canonico in pallet). */
export function pickupMetersEquivalent(p: {
  pallets: number | null;
  loadingMeters: number | null;
}): number {
  return pickupPalletEquivalent(p) * METERS_PER_PALLET;
}

/** Totale pallet del giro (pallet dichiarati o convertiti dai metri lineari). */
export function routeTotalPallets(route: RouteWithRelations): number {
  return Math.round(
    routePickups(route).reduce((sum, p) => sum + pickupPalletEquivalent(p), 0),
  );
}

/** Somma dei metri cubi delle prese del giro. */
export function routeTotalVolume(route: RouteWithRelations): number {
  return routePickups(route).reduce((sum, p) => sum + (p.volumeM3 ?? 0), 0);
}

/** Somma del peso (kg) delle prese del giro. */
export function routeTotalWeight(route: RouteWithRelations): number {
  return routePickups(route).reduce((sum, p) => sum + (p.weightKg ?? 0), 0);
}

/** Somma dei metri lineari (MTL) delle prese del giro. */
export function routeTotalLoadingMeters(route: RouteWithRelations): number {
  return routePickups(route).reduce((sum, p) => sum + (p.loadingMeters ?? 0), 0);
}

// Pallet EUR 80×120 cm: in un mezzo largo ~2,4 m stanno 2 pallet affiancati
// ogni 0,8 m di lunghezza → 0,4 m di carico per pallet (e 2,5 pallet per metro).
export const METERS_PER_PALLET = 0.4;
export const PALLETS_PER_METER = 1 / METERS_PER_PALLET; // 2,5

/**
 * Metri occupati sul mezzo dalle prese del giro (dal valore canonico in pallet),
 * arrotondato al metro. Es. 14 pallet × 0,4 = 5,6 → 6 m.
 */
export function routeOccupiedMeters(route: RouteWithRelations): number {
  const m = routePickups(route).reduce((sum, p) => sum + pickupMetersEquivalent(p), 0);
  return Math.round(m);
}

/** Numero di resi (fermate senza presa) nel giro. */
export function routeResiCount(route: RouteWithRelations): number {
  return route.stops.filter((s) => s.pickup == null).length;
}

/** True se il giro usa una motrice (mezzo costoso). */
export function routeUsesMotrice(route: RouteWithRelations): boolean {
  return route.vehicle?.vehicleType === "MOTRICE";
}

/** Giro della stessa giornata, per valutare se autista o mezzo sono già impegnati. */
export type DayRoute = {
  id: string;
  shift: RouteShift;
  driverId: string | null;
  vehicleId: string | null;
  stops: unknown[];
};

/**
 * Lista COMPLETA dei warning di un giro: unica fonte usata da pianificazione,
 * lista giri, dettaglio giro e Pianificazione Plus.
 *
 * @param dayRoutes tutti i giri della stessa giornata (il giro stesso può essere
 *   incluso: viene ignorato). Servono per "autista/mezzo già impegnato".
 */
export function getRouteWarnings(route: RouteWithRelations, dayRoutes: DayRoute[] = []): RouteWarning[] {
  const warnings: RouteWarning[] = [];

  if (!route.vehicle) warnings.push("vehicle_missing");
  if (!route.driver) warnings.push("driver_missing");

  const v = route.vehicle;
  const overPallets =
    v?.capacityPallets != null && routeTotalPallets(route) > v.capacityPallets;
  const overVolume =
    v?.capacityVolumeM3 != null && routeTotalVolume(route) > v.capacityVolumeM3;
  const overWeight =
    v?.capacityWeightKg != null && routeTotalWeight(route) > v.capacityWeightKg;
  if (overPallets || overVolume || overWeight) {
    warnings.push("capacity_exceeded");
  }

  // Mezzo non disponibile nella fascia del giro.
  if (route.vehicle && !vehicleCovers(route.vehicle.availability, route.shift)) {
    warnings.push("vehicle_unavailable");
  }

  // Almeno una presa in una fascia incompatibile col giro.
  const shiftMismatch = routePickups(route).some(
    (p) => !pickupFitsShift(p.timeWindow, route.shift),
  );
  if (shiftMismatch) warnings.push("pickup_shift_mismatch");

  const hasUnvalidated = routePickups(route).some((p) => hasMissingData(p));
  if (hasUnvalidated) warnings.push("contains_unvalidated_pickups");

  // Requisiti delle prese rispetto al mezzo assegnato.
  if (route.vehicle) {
    const pickups = routePickups(route);
    if (pickups.some((p) => p.requiresMotrice) && route.vehicle.vehicleType !== "MOTRICE") {
      warnings.push("motrice_required");
    }
    if (pickups.some((p) => p.requiresTailLift) && !route.vehicle.hasTailLift) {
      warnings.push("tail_lift_required");
    }
  }

  // Risorse già impegnate in altri giri della giornata con fascia sovrapposta.
  // Contano solo i giri effettivamente impegnati (con almeno una fermata).
  if (route.stops.length > 0) {
    const others = dayRoutes.filter(
      (o) => o.id !== route.id && o.stops.length > 0 && shiftsOverlap(o.shift, route.shift),
    );
    if (route.driverId && others.some((o) => o.driverId === route.driverId)) warnings.push("driver_busy");
    if (route.vehicleId && others.some((o) => o.vehicleId === route.vehicleId)) warnings.push("vehicle_busy");
  }

  return warnings;
}
