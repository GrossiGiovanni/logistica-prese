// Stato operativo della presa: CALCOLATO, mai salvato a mano.
//
// L'unico stato persistito è l'annullamento (cancelledAt). Tutto il resto si
// ricava dalla realtà, così non può divergere da essa:
//   Annullata     → cancelledAt valorizzato (prevale su tutto)
//   Pianificata   → associata a un giro
//   Pronta        → non in un giro, con dati di carico (pallet, metri o volume)
//   Da completare → non in un giro e senza dati di carico

export type PickupOperationalStatus = "ANNULLATA" | "PIANIFICATA" | "PRONTA" | "DA_COMPLETARE";

export type PickupStatusInput = {
  cancelledAt: Date | null;
  routeStopsCount: number;
  pallets: number | null;
  loadingMeters: number | null;
  volumeM3: number | null;
  /** Vecchio stato salvato: IGNORATO, conta solo la realtà del giro. */
  storedStatus?: string;
};

export const pickupOperationalStatusLabels: Record<PickupOperationalStatus, string> = {
  ANNULLATA: "Annullata",
  PIANIFICATA: "Pianificata",
  PRONTA: "Pronta",
  DA_COMPLETARE: "Da completare",
};

/** Stati selezionabili nei filtri (le annullate non compaiono mai nelle liste). */
export const pickupStatusFilterOptions = (["PRONTA", "DA_COMPLETARE", "PIANIFICATA"] as const).map((value) => ({
  value,
  label: pickupOperationalStatusLabels[value],
}));

/** Filtro stato da cookie/URL: valori sconosciuti (es. vecchi "READY") = nessun filtro. */
export function parsePickupStatusFilter(value: unknown): PickupOperationalStatus | undefined {
  return pickupStatusFilterOptions.some((o) => o.value === value) ? (value as PickupOperationalStatus) : undefined;
}

export function pickupOperationalStatus(p: PickupStatusInput): PickupOperationalStatus {
  if (p.cancelledAt != null) return "ANNULLATA";
  if (p.routeStopsCount > 0) return "PIANIFICATA";
  if (p.pallets != null || p.loadingMeters != null || p.volumeM3 != null) return "PRONTA";
  return "DA_COMPLETARE";
}

/** Stato calcolato a partire da una presa con le sue fermate (come caricata dalle pagine). */
export function pickupStatusOf(p: {
  cancelledAt: Date | null;
  routeStops: unknown[];
  pallets: number | null;
  loadingMeters: number | null;
  volumeM3: number | null;
}): PickupOperationalStatus {
  return pickupOperationalStatus({ ...p, routeStopsCount: p.routeStops.length });
}

/**
 * Presa "non assegnata" alla data indicata. È la STESSA regola della lista
 * delle prese da assegnare (che include i recuperi dei giorni precedenti),
 * così KPI e lista coincidono sempre.
 */
export function isUnassignedOn(
  p: { pickupDate: string; cancelledAt: Date | null; routeStopsCount: number },
  date: string,
): boolean {
  return p.cancelledAt == null && p.routeStopsCount === 0 && p.pickupDate <= date;
}
