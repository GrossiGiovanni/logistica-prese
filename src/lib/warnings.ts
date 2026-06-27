// Logica centralizzata per il calcolo dei warning su prese e giri.
// Usata sia lato server (generazione, KPI) sia lato UI (badge).

import type { Pickup, Vehicle, Driver, RouteStop, Route } from "@prisma/client";

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
  | "expensive_vehicle_used"
  | "contains_unvalidated_pickups";

export const pickupWarningLabels: Record<PickupWarning, string> = {
  missing_pallets: "Pallet mancanti",
  missing_notes: "Note mancanti",
  high_priority: "Priorità alta",
  requires_motrice: "Richiede motrice",
  requires_tail_lift: "Richiede sponda",
};

export const routeWarningLabels: Record<RouteWarning, string> = {
  vehicle_missing: "Mezzo mancante",
  driver_missing: "Autista mancante",
  capacity_exceeded: "Capacità superata",
  expensive_vehicle_used: "Mezzo costoso (motrice)",
  contains_unvalidated_pickups: "Prese con dati mancanti",
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
  expensive_vehicle_used: "blue",
  contains_unvalidated_pickups: "amber",
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

/**
 * Una presa è "con dati mancanti" se:
 * - non ha pallets; oppure
 * - non ha addressId; oppure
 * - non ha timeWindow; oppure
 * - ha rawNotes vuote e nessun altro dato operativo utile.
 */
export function hasMissingData(pickup: PickupLike): boolean {
  if (pickup.pallets == null) return true;
  if (!pickup.addressId) return true;
  if (!pickup.timeWindow) return true;

  const hasRawNotes = Boolean(pickup.rawNotes && pickup.rawNotes.trim().length > 0);
  const hasOperationalData =
    pickup.pallets != null ||
    pickup.colli != null ||
    pickup.weightKg != null ||
    pickup.volumeM3 != null;

  if (!hasRawNotes && !hasOperationalData) return true;

  return false;
}

/** Lista dei warning applicabili a una presa. */
export function getPickupWarnings(pickup: PickupLike): PickupWarning[] {
  const warnings: PickupWarning[] = [];

  if (pickup.pallets == null) warnings.push("missing_pallets");

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
  stops: (RouteStop & { pickup: PickupLike })[];
};

/** Somma dei pallet stimati delle prese del giro. */
export function routeTotalPallets(route: RouteWithRelations): number {
  return route.stops.reduce((sum, stop) => sum + (stop.pickup.pallets ?? 0), 0);
}

/** Somma dei metri cubi delle prese del giro. */
export function routeTotalVolume(route: RouteWithRelations): number {
  return route.stops.reduce((sum, stop) => sum + (stop.pickup.volumeM3 ?? 0), 0);
}

/** Somma del peso (kg) delle prese del giro. */
export function routeTotalWeight(route: RouteWithRelations): number {
  return route.stops.reduce((sum, stop) => sum + (stop.pickup.weightKg ?? 0), 0);
}

/** Somma dei metri lineari (MTL) delle prese del giro. */
export function routeTotalLoadingMeters(route: RouteWithRelations): number {
  return route.stops.reduce((sum, stop) => sum + (stop.pickup.loadingMeters ?? 0), 0);
}

/** True se il giro usa una motrice (mezzo costoso). */
export function routeUsesMotrice(route: RouteWithRelations): boolean {
  return route.vehicle?.vehicleType === "MOTRICE";
}

/** Lista dei warning applicabili a un giro. */
export function getRouteWarnings(route: RouteWithRelations): RouteWarning[] {
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

  if (
    route.vehicle?.vehicleType === "MOTRICE" ||
    route.vehicle?.costLevel === "HIGH"
  ) {
    warnings.push("expensive_vehicle_used");
  }

  const hasUnvalidated = route.stops.some((stop) => hasMissingData(stop.pickup));
  if (hasUnvalidated) warnings.push("contains_unvalidated_pickups");

  return warnings;
}
