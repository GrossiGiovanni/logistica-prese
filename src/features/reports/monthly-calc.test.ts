// Test dei calcoli del report mensile (consuntivo, forecast, costi, totali).
// Esecuzione: npm test
//
// Scenario base: ottobre 2026, oggi = martedì 06/10/2026.
// Giorni lavorativi del mese: 22; trascorsi (01,02,05,06): 4; rimanenti: 18.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeMonthlyStats, computeCostBreakdown, type MonthlyInput } from "./monthly-calc";
import { parseDateOnly } from "@/lib/dates";

const d = parseDateOnly;

const drivers = {
  E: { id: "E", name: "Eurosarda Uno", company: "EUROSARDA", isEurosarda: true },
  R: { id: "R", name: "Rama Uno", company: "RAMA", isEurosarda: false },
  O: { id: "O", name: "Omar Uno", company: "OMAR", isEurosarda: false },
} as const;

const vehicles = {
  bilico: { id: "v1", dailyCost: 400, costPerKm: null, vehicleType: "BILICO" },
  motrice: { id: "v2", dailyCost: 300, costPerKm: null, vehicleType: "MOTRICE" },
} as const;

function pickup(id: string, date: string, over: Partial<MonthlyInput["monthPickups"][number]> = {}) {
  return {
    id,
    pickupDate: d(date),
    status: "PLANNED" as const,
    pallets: null as number | null,
    loadingMeters: null as number | null,
    taxableVolumeM3: null as number | null,
    customerId: "C1",
    customer: { name: "Cliente Uno" },
    inConfirmedRoute: true,
    ...over,
  };
}

function route(
  id: string,
  date: string,
  driver: keyof typeof drivers | null,
  vehicle: keyof typeof vehicles,
  stops: ReturnType<typeof pickup>[],
  over: Partial<MonthlyInput["routes"][number]> = {},
): MonthlyInput["routes"][number] {
  const v = vehicles[vehicle];
  const drv = driver ? drivers[driver] : null;
  return {
    id,
    routeDate: d(date),
    status: "CONFIRMED",
    shift: "FULL_DAY",
    km: null,
    vehicleId: v.id,
    driverId: drv?.id ?? null,
    vehicle: v,
    driver: drv,
    stops: [...stops.map((p) => ({ pickup: p })), ...(over.stops ?? [])],
    ...over,
    ...(over.stops ? { stops: [...stops.map((p) => ({ pickup: p })), ...over.stops] } : {}),
  };
}

// --- Prese ---
const p1 = pickup("p1", "2026-10-01", { pallets: 10, taxableVolumeM3: 20 });
// Arretrata: data presa a settembre, eseguita nel giro del 01/10.
const p2 = pickup("p2", "2026-09-29", { loadingMeters: 4, taxableVolumeM3: 15 });
const p3 = pickup("p3", "2026-10-02", { pallets: 5, taxableVolumeM3: 10 });
const p4 = pickup("p4", "2026-10-05", { pallets: 6, taxableVolumeM3: 12 });
const p5 = pickup("p5", "2026-10-06", { pallets: 3, inConfirmedRoute: false }); // solo in bozza
const p6 = pickup("p6", "2026-10-08", { pallets: 4 }); // futura, già pianificata
const p7 = pickup("p7", "2026-10-05", { pallets: 2, inConfirmedRoute: false, status: "READY" });
const p8 = pickup("p8", "2026-10-02", { pallets: 9, status: "CANCELLED", inConfirmedRoute: false });
const p9 = pickup("p9", "2026-09-30", { pallets: 7, taxableVolumeM3: 30 }); // giro di settembre

function baseInput(over: Partial<MonthlyInput> = {}): MonthlyInput {
  return {
    month: "2026-10",
    today: "2026-10-06",
    routes: [
      route("r0", "2026-09-30", "R", "bilico", [p9]), // fuori mese
      route("r1", "2026-10-01", "R", "bilico", [p1, p2]),
      route("r2", "2026-10-02", "O", "motrice", [p3], { shift: "MORNING" }),
      route("r3", "2026-10-05", "E", "bilico", [p4], { km: 100, stops: [{ pickup: null }] }),
      route("r4", "2026-10-06", "R", "motrice", [p5], { status: "DRAFT" }),
      route("r5", "2026-10-08", "R", "bilico", [p6]),
    ],
    monthPickups: [p1, p3, p4, p5, p6, p7, p8],
    tractions: [
      { tractionDate: d("2026-10-02"), cost: 200, km: 150, driverId: "E" },
      { tractionDate: d("2026-10-12"), cost: 250, km: 90, driverId: "E" },
    ],
    carichi: [
      { loadDate: d("2026-10-05"), nolo: 500 },
      { loadDate: d("2026-10-20"), nolo: 600 },
    ],
    drivers: [
      { id: "E", name: "Eurosarda Uno", active: true, defaultVehicle: { vehicleType: "BILICO" } },
      { id: "R", name: "Rama Uno", active: true, defaultVehicle: { vehicleType: "BILICO" } },
      { id: "O", name: "Omar Uno", active: true, defaultVehicle: { vehicleType: "MOTRICE" } },
    ],
    ...over,
  };
}

const close = (actual: number, expected: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${msg ?? ""} atteso ${expected}, ottenuto ${actual}`);

describe("1. Consuntivo: solo dati fino a oggi", () => {
  test("i giri futuri non entrano nel registrato", () => {
    const s = computeMonthlyStats(baseInput());
    assert.equal(s.routesCount, 3); // r1, r2, r3
    close(s.costs.total, 400 + 150 + 400 + 200 + 500, "costo registrato");
  });

  test("trazioni e noli futuri non entrano nel registrato", () => {
    const s = computeMonthlyStats(baseInput());
    close(s.costs.trazioni, 200);
    close(s.costs.noli, 500);
  });
});

describe("2. Prese effettuate = prese nei giri confermati del periodo", () => {
  test("conta le prese dei giri, inclusa l'arretrata, esclude le non eseguite", () => {
    const s = computeMonthlyStats(baseInput());
    assert.equal(s.pickupsCount, 4); // p1, p2 (arretrata), p3, p4
  });

  test("volume tassabile e pallet equivalenti dalle prese eseguite", () => {
    const s = computeMonthlyStats(baseInput());
    close(s.volumeM3, 20 + 15 + 10 + 12);
    close(s.pallets, 10 + 4 * 2.5 + 5 + 6, "pallet equivalenti (MTL × 2,5)");
  });

  test("una presa su due giri confermati è contata una sola volta", () => {
    const input = baseInput();
    input.routes[3].stops.push({ pickup: p3 }); // p3 anche in r3
    const s = computeMonthlyStats(input);
    assert.equal(s.pickupsCount, 4);
    close(s.volumeM3, 57);
  });

  test("una presa di settembre eseguita a settembre non conta a ottobre", () => {
    const s = computeMonthlyStats(baseInput());
    assert.ok(s.volumeM3 < 30 + 57);
  });
});

describe("3. Giri in bozza", () => {
  test("i giri in bozza non entrano in costi e KPI, ma sono esposti a parte", () => {
    const s = computeMonthlyStats(baseInput());
    close(s.costs.rama, 400, "Rama solo r1");
    assert.equal(s.draftRoutesCount, 1);
    close(s.draftCost, 300);
  });
});

describe("4. Forecast", () => {
  test("base giorni lavorativi trascorsi coerente", () => {
    const s = computeMonthlyStats(baseInput());
    assert.equal(s.workdaysTotal, 22);
    assert.equal(s.workdaysElapsed, 4);
    assert.equal(s.workdaysRemaining, 18);
  });

  test("giorni già pianificati usano il pianificato, gli altri la media (no doppio conteggio)", () => {
    const s = computeMonthlyStats(baseInput());
    // prese: 4 registrate, media 1/giorno; 08/10 pianificata 1 presa; 17 giorni a media.
    close(s.projectedPickups, 4 + 1 + 17 * 1, "prese previste");
    // volume: media 57/4 al giorno; il giorno pianificato stima 1 presa × 14,25.
    close(s.projectedVolume, 57 + 14.25 + 17 * 14.25, "volume previsto");
    // raccolta: 950 registrato, media 237,5; 08/10 pianificato 400.
    close(s.projectedCosts.raccolta, 950 + 400 + 17 * 237.5, "raccolta prevista");
    // trazioni: 200, media 50; 12/10 pianificata 250.
    close(s.projectedCosts.trazioni, 200 + 250 + 17 * 50, "trazioni previste");
    // noli: 500, media 125; 20/10 pianificato 600.
    close(s.projectedCosts.noli, 500 + 600 + 17 * 125, "noli previsti");
    close(
      s.projectedCosts.total,
      s.projectedCosts.raccolta + s.projectedCosts.trazioni + s.projectedCosts.noli,
    );
  });

  test("mese concluso: forecast = consuntivo", () => {
    const s = computeMonthlyStats(baseInput({ today: "2026-11-10" }));
    assert.equal(s.workdaysRemaining, 0);
    assert.equal(s.workdaysElapsed, 22);
    close(s.projectedPickups, s.pickupsCount);
    close(s.projectedCosts.total, s.costs.total);
  });

  test("mese futuro: niente registrato, forecast = solo pianificato, nessun NaN", () => {
    const s = computeMonthlyStats(baseInput({ month: "2026-11", routes: [], tractions: [], carichi: [], monthPickups: [] }));
    assert.equal(s.workdaysElapsed, 0);
    assert.equal(s.pickupsCount, 0);
    close(s.projectedPickups, 0);
    close(s.projectedCosts.total, 0);
  });
});

describe("5. Costi separati", () => {
  test("Rama, Omar, Industriale ritiri, trazioni, noli", () => {
    const s = computeMonthlyStats(baseInput());
    close(s.costs.rama, 400);
    close(s.costs.omar, 150); // motrice 300 × mezza giornata
    close(s.costs.industrialeRitiri, 400);
    close(s.costs.trazioni, 200);
    close(s.costs.noli, 500);
  });

  test("raccolta = Rama + Omar + Industriale ritiri, trazioni separate", () => {
    const s = computeMonthlyStats(baseInput());
    close(s.costs.raccolta, s.costs.rama + s.costs.omar + s.costs.industrialeRitiri);
    close(s.costs.raccolta, 950);
    close(s.costs.total, s.costs.raccolta + s.costs.nonClassificato + s.costs.trazioni + s.costs.noli);
  });

  test("giro senza autista o con azienda diversa: non classificato, fuori dalla raccolta", () => {
    const input = baseInput();
    input.routes.push(route("rx", "2026-10-05", null, "motrice", []));
    const s = computeMonthlyStats(input);
    close(s.costs.nonClassificato, 300);
    close(s.costs.raccolta, 950);
    close(s.costs.total, 950 + 300 + 200 + 500);
  });
});

describe("6. Azienda autista", () => {
  test("la classificazione usa l'azienda, non il flag o il nome", () => {
    const input = baseInput();
    // Autista Rama erroneamente marcato col vecchio flag Eurosarda.
    const ramaConFlag = { ...drivers.R, isEurosarda: true };
    input.routes[1].driver = ramaConFlag;
    const s = computeMonthlyStats(input);
    close(s.costs.rama, 400);
    close(s.costs.industrialeRitiri, 400);
  });
});

describe("7. Totali", () => {
  test("mezzi utilizzati: distinti per giorno sui giri confermati fino a oggi", () => {
    const s = computeMonthlyStats(baseInput());
    assert.equal(s.vehiclesUsed, 2); // v1, v2
    assert.equal(s.operativeDays, 3); // 01, 02, 05
    close(s.avgVehiclesPerDay, 1);
  });

  test("km autisti: solo giri confermati e trazioni fino a oggi", () => {
    const s = computeMonthlyStats(baseInput());
    const e = s.kmRows.find((r) => r.id === "E")!;
    close(e.km, 100 + 150);
    const r = s.kmRows.find((r) => r.id === "R")!;
    close(r.km, 0);
  });

  test("km di un autista disattivato restano visibili", () => {
    const input = baseInput();
    input.drivers = input.drivers.map((x) => (x.id === "E" ? { ...x, active: false } : x));
    const s = computeMonthlyStats(input);
    assert.ok(s.kmRows.some((r) => r.id === "E" && r.km === 250));
  });

  test("prese non assegnate: fino a oggi, non annullate, senza giro confermato", () => {
    const s = computeMonthlyStats(baseInput());
    assert.equal(s.unassignedPickups, 2); // p5 (solo bozza), p7
  });

  test("costi giornalieri sommati = costi mensili", () => {
    const input = baseInput();
    const s = computeMonthlyStats(input);
    const days = ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"];
    const sum = days
      .map((day) =>
        computeCostBreakdown({
          routes: input.routes.filter((r) => r.routeDate.getTime() === d(day).getTime()),
          tractions: input.tractions.filter((t) => t.tractionDate.getTime() === d(day).getTime()),
          carichi: input.carichi.filter((c) => c.loadDate.getTime() === d(day).getTime()),
        }).total,
      )
      .reduce((a, b) => a + b, 0);
    close(sum, s.costs.total);
  });
});
