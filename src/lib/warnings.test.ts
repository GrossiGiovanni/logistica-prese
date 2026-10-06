import { describe, expect, it } from "vitest";
import { getRouteWarnings, routeWarningLabels, routeWarningTone } from "./warnings";

type Route = Parameters<typeof getRouteWarnings>[0];

let seq = 0;
function giro(o: {
  shift?: "MORNING" | "AFTERNOON" | "FULL_DAY";
  driverId?: string | null;
  vehicle?: { type?: string; tailLift?: boolean; id?: string } | null;
  prese?: { motrice?: boolean; sponda?: boolean; pallets?: number }[];
}): Route {
  const id = `r${++seq}`;
  const v = o.vehicle === null ? null : {
    id: o.vehicle?.id ?? `v-${id}`,
    vehicleType: o.vehicle?.type ?? "BILICO",
    hasTailLift: o.vehicle?.tailLift ?? false,
    availability: "FULL_DAY",
    capacityPallets: 33,
    capacityVolumeM3: null,
    capacityWeightKg: null,
  };
  return {
    id,
    shift: o.shift ?? "FULL_DAY",
    driverId: o.driverId === undefined ? `d-${id}` : o.driverId,
    vehicleId: v?.id ?? null,
    vehicle: v,
    driver: o.driverId === null ? null : { id: o.driverId ?? `d-${id}` },
    stops: (o.prese ?? [{}]).map((p, i) => ({
      id: `${id}-s${i}`,
      pickup: {
        addressId: "a", timeWindow: "ANYTIME", rawNotes: "x", internalNotes: null,
        pallets: p.pallets ?? 4, loadingMeters: null, volumeM3: null, weightKg: null, colli: null,
        priority: "NORMAL", requiresMotrice: p.motrice ?? false, requiresTailLift: p.sponda ?? false,
      },
    })),
  } as unknown as Route;
}

describe("requisiti della presa vs mezzo", () => {
  it("presa che richiede MOTRICE su un mezzo non motrice", () => {
    expect(getRouteWarnings(giro({ vehicle: { type: "BILICO" }, prese: [{ motrice: true }] }))).toContain("motrice_required");
  });

  it("nessun avviso se il mezzo è una motrice", () => {
    expect(getRouteWarnings(giro({ vehicle: { type: "MOTRICE" }, prese: [{ motrice: true }] }))).not.toContain("motrice_required");
  });

  it("presa che richiede SPONDA su un mezzo senza sponda", () => {
    expect(getRouteWarnings(giro({ vehicle: { tailLift: false }, prese: [{ sponda: true }] }))).toContain("tail_lift_required");
  });

  it("nessun avviso se il mezzo ha la sponda", () => {
    expect(getRouteWarnings(giro({ vehicle: { tailLift: true }, prese: [{ sponda: true }] }))).not.toContain("tail_lift_required");
  });
});

describe("risorse già impegnate nella giornata", () => {
  it("AUTISTA già impegnato in un altro giro con fascia sovrapposta", () => {
    const a = giro({ driverId: "mario", shift: "FULL_DAY" });
    const b = giro({ driverId: "mario", shift: "MORNING" });
    expect(getRouteWarnings(a, [a, b])).toContain("driver_busy");
    expect(getRouteWarnings(b, [a, b])).toContain("driver_busy");
  });

  it("MEZZO già impegnato in un altro giro con fascia sovrapposta", () => {
    const a = giro({ vehicle: { id: "bilico-1" }, shift: "MORNING" });
    const b = giro({ vehicle: { id: "bilico-1" }, shift: "FULL_DAY" });
    expect(getRouteWarnings(a, [a, b])).toContain("vehicle_busy");
  });

  it("autista e mezzo sono avvisi DISTINTI", () => {
    const a = giro({ driverId: "mario", vehicle: { id: "v1" } });
    const b = giro({ driverId: "mario", vehicle: { id: "v2" } });
    const w = getRouteWarnings(a, [a, b]);
    expect(w).toContain("driver_busy");
    expect(w).not.toContain("vehicle_busy");
  });

  it("mattina e pomeriggio NON si sovrappongono", () => {
    const a = giro({ driverId: "mario", shift: "MORNING" });
    const b = giro({ driverId: "mario", shift: "AFTERNOON" });
    expect(getRouteWarnings(a, [a, b])).not.toContain("driver_busy");
  });

  it("un giro vuoto non impegna la risorsa", () => {
    const a = giro({ driverId: "mario" });
    const vuoto = giro({ driverId: "mario", prese: [] });
    expect(getRouteWarnings(a, [a, vuoto])).not.toContain("driver_busy");
  });
});

describe("coerenza per l'interfaccia", () => {
  it("ogni warning ha etichetta e colore", () => {
    for (const w of ["motrice_required", "tail_lift_required", "driver_busy", "vehicle_busy"] as const) {
      expect(routeWarningLabels[w]).toBeTruthy();
      expect(routeWarningTone[w]).toBeTruthy();
    }
  });
});
