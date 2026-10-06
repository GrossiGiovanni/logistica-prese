import { describe, expect, it } from "vitest";
import { isUnassignedOn, pickupOperationalStatus, type PickupStatusInput } from "./pickup-status";

describe("KPI 'Non assegnate' = esattamente la lista delle prese non assegnate", () => {
  const OGGI = "2026-10-06";
  const p = (o: Partial<{ pickupDate: string; cancelledAt: Date | null; routeStopsCount: number }> = {}) => ({
    pickupDate: OGGI, cancelledAt: null, routeStopsCount: 0, ...o,
  });

  it("include le prese da recuperare dei giorni precedenti (come la lista)", () => {
    // Prima: la lista le mostrava, il KPI no → numeri diversi.
    expect(isUnassignedOn(p({ pickupDate: "2026-10-03" }), OGGI)).toBe(true);
  });
  it("include le prese del giorno non in un giro", () => {
    expect(isUnassignedOn(p(), OGGI)).toBe(true);
  });
  it("esclude le prese già in un giro", () => {
    expect(isUnassignedOn(p({ routeStopsCount: 1 }), OGGI)).toBe(false);
  });
  it("esclude le prese annullate", () => {
    expect(isUnassignedOn(p({ cancelledAt: new Date() }), OGGI)).toBe(false);
  });
  it("esclude le prese dei giorni futuri", () => {
    expect(isUnassignedOn(p({ pickupDate: "2026-10-07" }), OGGI)).toBe(false);
  });
});

const presa = (over: Partial<PickupStatusInput> = {}): PickupStatusInput => ({
  cancelledAt: null,
  routeStopsCount: 0,
  pallets: null,
  loadingMeters: null,
  volumeM3: null,
  ...over,
});

describe("stato presa calcolato (nessuno stato operativo salvato a mano)", () => {
  it("'Pianificata' = associata a un giro", () => {
    expect(pickupOperationalStatus(presa({ routeStopsCount: 1, pallets: 4 }))).toBe("PIANIFICATA");
  });

  it("'Pronta' = non in un giro, con dati di carico (pallet, metri o volume)", () => {
    expect(pickupOperationalStatus(presa({ pallets: 4 }))).toBe("PRONTA");
    expect(pickupOperationalStatus(presa({ loadingMeters: 2 }))).toBe("PRONTA");
    expect(pickupOperationalStatus(presa({ volumeM3: 5 }))).toBe("PRONTA");
  });

  it("'Da completare' = non in un giro e senza dati di carico", () => {
    expect(pickupOperationalStatus(presa())).toBe("DA_COMPLETARE");
  });

  it("'Annullata' è l'unico stato persistito e prevale su tutto", () => {
    const annullata = presa({ cancelledAt: new Date(), routeStopsCount: 1, pallets: 4 });
    expect(pickupOperationalStatus(annullata)).toBe("ANNULLATA");
  });

  it("uno stato salvato vecchio NON conta: decide la realtà del giro", () => {
    // Prima: lo stato "PLANNED" restava anche dopo l'uscita dal giro.
    expect(pickupOperationalStatus(presa({ storedStatus: "PLANNED", routeStopsCount: 0, pallets: 4 }))).toBe("PRONTA");
    // Prima: lo stato "READY" restava anche dopo l'assegnazione a un giro.
    expect(pickupOperationalStatus(presa({ storedStatus: "READY", routeStopsCount: 1, pallets: 4 }))).toBe("PIANIFICATA");
  });
});
