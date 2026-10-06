// Costo del singolo giro e classificazione dei carichi.
// La ripartizione completa (aziende, Industriale, noli, forecast) è collaudata
// in src/features/reports/monthly-calc.test.ts.
import { describe, expect, it } from "vitest";
import { isIndustrialCarico, routeTotalCost } from "./costs";

describe("costo del singolo giro (comportamento consolidato)", () => {
  const bilico = { dailyCost: 400, costPerKm: null };
  it("giornata intera = quota fissa piena", () => {
    expect(routeTotalCost({ shift: "FULL_DAY", km: 120, vehicle: bilico })).toBe(400);
  });
  it("mezza giornata = metà quota fissa", () => {
    expect(routeTotalCost({ shift: "MORNING", km: 80, vehicle: bilico })).toBe(200);
  });
  it("quota fissa + km", () => {
    expect(routeTotalCost({ shift: "FULL_DAY", km: 100, vehicle: { dailyCost: 300, costPerKm: 0.5 } })).toBe(350);
  });
  it("senza dati di costo = null (non zero)", () => {
    expect(routeTotalCost({ shift: "FULL_DAY", km: 100, vehicle: null })).toBeNull();
  });
});

describe("carico = trazione industriale se fatto da Eurosarda", () => {
  it("autista con azienda Eurosarda → industriale", () => {
    expect(isIndustrialCarico({ driver: { company: "EUROSARDA" }, trazionista: null })).toBe(true);
  });
  it("vettore marcato Eurosarda in anagrafica → industriale (anche senza autista indicato)", () => {
    expect(isIndustrialCarico({ driver: null, trazionista: { isEurosarda: true } })).toBe(true);
  });
  it("altri vettori → nolo esterno", () => {
    expect(isIndustrialCarico({ driver: null, trazionista: { isEurosarda: false } })).toBe(false);
    expect(isIndustrialCarico({ driver: null, trazionista: null })).toBe(false);
  });
  it("autista di altra azienda → nolo esterno", () => {
    expect(isIndustrialCarico({ driver: { company: "RAMA" }, trazionista: null })).toBe(false);
    expect(isIndustrialCarico({ driver: { company: "ALTRO" }, trazionista: null })).toBe(false);
  });
});
