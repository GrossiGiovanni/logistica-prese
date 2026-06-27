// Etichette italiane per gli enum del dominio.
// I valori enum restano in inglese nel DB/codice; qui mappiamo la UI in italiano.

import type {
  VehicleType,
  CostLevel,
  PickupSourceType,
  PickupStatus,
  TimeWindow,
  Priority,
  RouteShift,
  RouteStatus,
} from "@prisma/client";

export const vehicleTypeLabels: Record<VehicleType, string> = {
  VAN: "Furgone",
  TRUCK: "Camion",
  BILICO: "Bilico",
  MOTRICE: "Motrice",
};

export const costLevelLabels: Record<CostLevel, string> = {
  LOW: "Basso",
  MEDIUM: "Medio",
  HIGH: "Alto",
};

export const pickupSourceLabels: Record<PickupSourceType, string> = {
  SPOT: "Spot",
  RECURRING: "Fissa",
};

export const pickupStatusLabels: Record<PickupStatus, string> = {
  DRAFT: "Bozza",
  READY: "Pronta",
  PLANNED: "Pianificata",
  CANCELLED: "Annullata",
};

export const timeWindowLabels: Record<TimeWindow, string> = {
  MORNING: "Mattina",
  AFTERNOON: "Pomeriggio",
  ANYTIME: "Giornata intera",
  SPECIFIC: "Orario preciso",
};

/** Le 3 fasce operative selezionabili su una presa. */
export const pickupShiftOptions: { value: TimeWindow; label: string }[] = [
  { value: "MORNING", label: "Mattina" },
  { value: "AFTERNOON", label: "Pomeriggio" },
  { value: "ANYTIME", label: "Giornata intera" },
];

export const priorityLabels: Record<Priority, string> = {
  NORMAL: "Normale",
  HIGH: "Alta",
  MANDATORY: "Tassativa",
};

export const routeShiftLabels: Record<RouteShift, string> = {
  MORNING: "Mattina",
  AFTERNOON: "Pomeriggio",
  FULL_DAY: "Giornata intera",
};

export const routeStatusLabels: Record<RouteStatus, string> = {
  DRAFT: "Bozza",
  CONFIRMED: "Confermato",
};

/** Nome visualizzato di un giro: "Autista / Mezzo". */
export function routeLabel(route: {
  driver?: { name: string } | null;
  vehicle?: { name: string } | null;
}): string {
  return `${route.driver?.name ?? "Autista da assegnare"} / ${route.vehicle?.name ?? "Mezzo da assegnare"}`;
}

// Helper per costruire le opzioni dei <select> a partire da una mappa di label.
export function toOptions<T extends string>(
  map: Record<T, string>,
): { value: T; label: string }[] {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value] }));
}
