// Test del parser AS400 su esempi REALI.
// Tracciati, formati del numero presa e testi delle note sono presi dalle
// estrazioni AS400 effettive; nomi e indirizzi dei clienti sono sostituiti da
// segnaposto per non pubblicare dati dei clienti nel repository.

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseAs400Workbook, type ParsedRow } from "./parse";
import { buildExistingPickupUpdate, pickupIdentityKey, type ExistingPickup } from "./merge";

async function xlsx(headers: (string | null)[], rows: unknown[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Foglio1");
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const D = new Date("2026-07-15T00:00:00.000Z");
const CLIENTE = ["CLIENTE ESEMPIO SRL", "VIA ESEMPIO 1", "MILANO", "MI"];

async function one(headers: (string | null)[], row: unknown[]): Promise<ParsedRow> {
  const res = await parseAs400Workbook(await xlsx(headers, [row]));
  expect(res.headerError).toBeUndefined();
  return res.rows[0];
}

// --- Tracciati reali -------------------------------------------------------
const MENSILE = ["N.PRESA", "DATA", "MITTENTE", "INDIRIZZO", "LOCALITà", "ZONA", "NOTE", "COLLI", "PRESO", "M.CUBI"];
const SETTIMANALE = ["NUMERO PRESA", "DATA", "MITTENTE", "INDIRIZZO", "LOCALITA'", "PROV.", "NOTE", "COLLI", "PESO", "MC"];
const DA_TXT = ["N. presa", "Data", "Mittente", "Indirizzo", "LocalitÃ ", "Pro", "plt", "note", "Colli", "Peso", "M.cu"];

describe("tracciati reali", () => {
  it("mensile: numero presa numerico, peso in 'PRESO'", async () => {
    const r = await one(MENSILE, [9005230, D, ...CLIENTE, "4 PLT - 1580 KG.", 12, 1580, 3.5]);
    expect(r.numero).toBe("9005230");
    expect(r.date).toBe("2026-07-15");
    expect(r.pallets).toBe(4);
    expect(r.weightKg).toBe(1580);
    expect(r.volumeM3).toBe(3.5);
    expect(r.colli).toBe(12);
  });

  it("settimanale: numero presa lungo 'anno serie numero'", async () => {
    const r = await one(SETTIMANALE, ["2026 13 9005032", D, ...CLIENTE, "27 PLT - ORE 16,00", null, null, null]);
    expect(r.numero).toBe("2026 13 9005032");
    expect(r.pallets).toBe(27);
    expect(r.timeFrom).toBe("16:00");
    expect(r.timeWindow).toBe("AFTERNOON");
  });

  it("da file txt: riconosce anche l'intestazione corrotta 'LocalitÃ '", async () => {
    const r = await one(DA_TXT, ["2026 13 9005040", D, ...CLIENTE, "5 PLT ORE 14", null, 20, 900, null]);
    expect(r.city).toBe("MILANO");
    expect(r.pallets).toBe(5);
    expect(r.timeFrom).toBe("14:00");
  });
});

// --- Orari: ORE solo come parola intera -----------------------------------
describe("ORE come parola intera", () => {
  it.each([
    ["COLLETTAME - ORE 8,00", "08:00", "MORNING"],
    ["3 PLT ORE 15.30", "15:30", "AFTERNOON"],
    ["1 PLT - ORE 15,30", "15:30", "AFTERNOON"],
    ["8 PLT ORE 11", "11:00", "MORNING"],
  ])("riconosce '%s'", async (note, from, window) => {
    const r = await one(MENSILE, [9005001, D, ...CLIENTE, note, null, null, null]);
    expect(r.timeFrom).toBe(from);
    expect(r.timeWindow).toBe(window);
  });

  it.each([
    "2 PLT - MOTORE 15",
    "1 PLT - DOTTORE 10 RITIRO",
    "4 PLT - FIORE 9",
  ])("NON inventa un orario da '%s'", async (note) => {
    const r = await one(MENSILE, [9005002, D, ...CLIENTE, note, null, null, null]);
    expect(r.timeFrom).toBeNull();
    expect(r.timeWindow).toBe("ANYTIME");
  });
});

// --- Pesi con il punto delle migliaia ---------------------------------------
describe("pesi con punto delle migliaia", () => {
  it("nelle note: '1.700 KG' sono 1700 kg, non 1,7", async () => {
    const r = await one(MENSILE, [9005003, D, ...CLIENTE, "2 PLT - 1.700 KG.", null, null, null]);
    expect(r.weightKg).toBe(1700);
  });

  it("nella colonna peso come testo: '1.580' sono 1580 kg", async () => {
    const r = await one(MENSILE, [9005004, D, ...CLIENTE, "2 PLT", null, "1.580", null]);
    expect(r.weightKg).toBe(1580);
  });

  it("formato italiano completo: '1.580,5' sono 1580,5 kg", async () => {
    const r = await one(MENSILE, [9005005, D, ...CLIENTE, "2 PLT", null, "1.580,5", null]);
    expect(r.weightKg).toBe(1580.5);
  });

  it("i pesi già numerici restano invariati", async () => {
    const r = await one(MENSILE, [9005006, D, ...CLIENTE, "2 PLT 2000 KG", null, null, null]);
    expect(r.weightKg).toBe(2000);
  });

  it("il VOLUME non usa il punto delle migliaia: '1.5' m³ restano 1,5", async () => {
    const r = await one(MENSILE, [9005007, D, ...CLIENTE, "2 PLT", null, null, "1.5"]);
    expect(r.volumeM3).toBe(1.5);
  });
});

// --- Colonne note1 e note distinte ------------------------------------------
describe("colonne 'note1' e 'note' distinte", () => {
  const CON_NOTE1 = ["N. presa", "Data", "Mittente", "Indirizzo", "Località", "Pro", "note1", "note", "Colli", "Peso", "M.cu"];

  it("legge il carico da note1 e l'orario da note, senza confonderle", async () => {
    const r = await one(CON_NOTE1, ["2026 13 9005050", D, ...CLIENTE, "4 PLT", "ORE 15,00 CONSEGNA", null, null, null]);
    expect(r.pallets).toBe(4);
    expect(r.timeFrom).toBe("15:00");
    expect(r.rawNotes).toContain("4 PLT");
    expect(r.rawNotes).toContain("ORE 15,00 CONSEGNA");
  });

  it("funziona anche se 'note' viene prima di 'note1'", async () => {
    const inverse = ["N. presa", "Data", "Mittente", "Indirizzo", "Località", "Pro", "note", "note1", "Colli", "Peso", "M.cu"];
    const r = await one(inverse, ["2026 13 9005051", D, ...CLIENTE, "ORE 9", "6 PLT", null, null, null]);
    expect(r.pallets).toBe(6);
    expect(r.timeFrom).toBe("09:00");
  });
});

// --- Numero presa completo come chiave --------------------------------------
describe("identità della presa: numero completo (anno + numero)", () => {
  it("formato lungo e corto della STESSA presa coincidono", () => {
    expect(pickupIdentityKey("2026 13 9005032", "2026-07-15")).toBe(pickupIdentityKey("9005032", "2026-07-15"));
  });

  it("stesso numero in anni diversi = prese DIVERSE (cambio d'anno)", () => {
    expect(pickupIdentityKey("9005032", "2027-01-10")).not.toBe(pickupIdentityKey("9005032", "2026-07-15"));
  });

  it("l'anno del formato lungo prevale sulla data", () => {
    // presa numerata nel 2026 ma ritirata a gennaio 2027
    expect(pickupIdentityKey("2026 13 9005032", "2027-01-02")).toBe(pickupIdentityKey("2026 13 9005032", "2026-12-30"));
  });
});

// --- Aggiornamento di una presa esistente -----------------------------------
const esistente = (over: Partial<ExistingPickup> = {}): ExistingPickup => ({
  pallets: 10,
  loadingMeters: 4,
  rawNotes: "10 PLT - NOTE MANUALI",
  routeStopsCount: 0,
  ...over,
});
const riga = (over: Partial<ParsedRow> = {}): ParsedRow => ({
  rowNumber: 2, numero: "9005032", date: "2026-07-15", mittente: "X", street: "Y", city: "Z", province: "MI",
  pallets: null, loadingMeters: null, volumeM3: null, weightKg: null, colli: null,
  timeWindow: "ANYTIME", timeFrom: null, requiresMotrice: false, rawNotes: null,
  ...over,
});

describe("aggiornamento presa esistente (import operativo)", () => {
  it("NON sovrascrive dati esistenti con valori vuoti", () => {
    const u = buildExistingPickupUpdate(esistente(), riga({ weightKg: 900 }), { aggiornamento: false });
    expect(u).not.toHaveProperty("pallets");
    expect(u).not.toHaveProperty("loadingMeters");
    expect(u).not.toHaveProperty("rawNotes");
    expect(u).not.toHaveProperty("colli");
    expect(u.weightKg).toBe(900);
  });

  it("NON modifica la fascia (eventualmente inserita a mano)", () => {
    const u = buildExistingPickupUpdate(esistente(), riga({ pallets: 12, timeWindow: "AFTERNOON", timeFrom: "16:00" }), { aggiornamento: false });
    expect(u).not.toHaveProperty("timeWindow");
    expect(u).not.toHaveProperty("timeFrom");
    expect(u.pallets).toBe(12);
  });

  it("NON toglie la richiesta motrice impostata a mano", () => {
    const u = buildExistingPickupUpdate(esistente(), riga({ pallets: 12, requiresMotrice: false }), { aggiornamento: false });
    expect(u).not.toHaveProperty("requiresMotrice");
  });

  it("NON scrive lo stato (è calcolato, non persistito)", () => {
    const u = buildExistingPickupUpdate(esistente(), riga({ pallets: 12 }), { aggiornamento: false });
    expect(u).not.toHaveProperty("status");
  });

  it("una data mancante non produce una data non valida", () => {
    const u = buildExistingPickupUpdate(esistente(), riga({ date: null, pallets: 5 }), { aggiornamento: false });
    expect(u).not.toHaveProperty("pickupDate");
  });

  it("presa già in un giro: aggiorna solo il consuntivo", () => {
    const u = buildExistingPickupUpdate(
      esistente({ routeStopsCount: 1 }),
      riga({ pallets: 99, weightKg: 1200, volumeM3: 8, date: "2026-07-20" }),
      { aggiornamento: false },
    );
    expect(u).toEqual({ weightKg: 1200, volumeM3: 8, taxableVolumeM3: 8 });
  });
});
