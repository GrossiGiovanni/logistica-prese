import { test, describe, afterEach, expect, it, vi } from "vitest";
import assert from "node:assert/strict";
import {
  todayInputValue,
  tomorrowInputValue,
  yesterdayInputValue,
  isValidDateInput,
  isValidMonthInput,
  normalizeMonth,
  safeDateInput,
  safeDateParam,
  safeMonthParam,
} from "./dates";

describe("8. Oggi/domani in Europe/Rome", () => {
  test("00:30 ora italiana del 06/10 (22:30 UTC del 05/10) è già il 06/10", () => {
    const now = new Date("2026-10-05T22:30:00Z");
    assert.equal(todayInputValue(now), "2026-10-06");
    assert.equal(tomorrowInputValue(now), "2026-10-07");
    assert.equal(yesterdayInputValue(now), "2026-10-05");
  });

  test("ora solare (inverno, UTC+1): 23:30 UTC del 31/12 è già il 01/01", () => {
    const now = new Date("2026-12-31T23:30:00Z");
    assert.equal(todayInputValue(now), "2027-01-01");
  });

  test("pomeriggio: stesso giorno in UTC e a Roma", () => {
    assert.equal(todayInputValue(new Date("2026-10-06T12:00:00Z")), "2026-10-06");
  });
});

describe("8. Validazione parametri data/mese", () => {
  test("date inesistenti o malformate sono rifiutate", () => {
    assert.equal(isValidDateInput("2026-10-06"), true);
    assert.equal(isValidDateInput("2026-02-29"), false);
    assert.equal(isValidDateInput("2026-02-31"), false);
    assert.equal(isValidDateInput("2026-13-01"), false);
    assert.equal(isValidDateInput("2026-10-6"), false);
    assert.equal(isValidDateInput("abc"), false);
    assert.equal(isValidDateInput(undefined), false);
  });

  test("mesi validi", () => {
    assert.equal(isValidMonthInput("2026-10"), true);
    assert.equal(isValidMonthInput("2026-00"), false);
    assert.equal(isValidMonthInput("2026-13"), false);
    assert.equal(isValidMonthInput("2026-1"), false);
  });

  test("normalizeMonth ricade sul mese corrente (Roma) se non valido", () => {
    const now = new Date("2026-10-31T23:30:00Z"); // già 1 novembre a Roma
    assert.equal(normalizeMonth("2026-13", now), "2026-11");
    assert.equal(normalizeMonth(undefined, now), "2026-11");
    assert.equal(normalizeMonth("2026-09", now), "2026-09");
  });

  test("safeDateInput restituisce il primo valore valido", () => {
    assert.equal(safeDateInput(["2026-02-31", undefined, "2026-10-07"], "2026-01-01"), "2026-10-07");
    assert.equal(safeDateInput(["xx"], "2026-01-01"), "2026-01-01");
  });
});

// --- Test aggiuntivi (parametri pagina, fake timers) ---

// Il server (Vercel) gira in UTC; "oggi" deve invece essere il giorno italiano.
describe("oggi/domani in ora italiana (Europe/Rome)", () => {
  afterEach(() => vi.useRealTimers());

  it("di giorno UTC e Roma coincidono", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:00:00Z"));
    expect(todayInputValue()).toBe("2026-10-05");
    expect(tomorrowInputValue()).toBe("2026-10-06");
    expect(yesterdayInputValue()).toBe("2026-10-04");
  });

  it("dopo la mezzanotte italiana (ora legale, UTC+2) è già il giorno dopo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T23:30:00Z")); // Roma: 6 ottobre, 01:30
    expect(todayInputValue()).toBe("2026-10-06");
    expect(tomorrowInputValue()).toBe("2026-10-07");
  });

  it("vale anche con l'ora solare (UTC+1) e a cavallo d'anno", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T23:30:00Z")); // Roma: 1 gennaio 2027, 00:30
    expect(todayInputValue()).toBe("2027-01-01");
  });

  it("poco prima della mezzanotte italiana è ancora lo stesso giorno", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T21:59:00Z")); // Roma: 5 ottobre, 23:59
    expect(todayInputValue()).toBe("2026-10-05");
  });
});

describe("validazione date", () => {
  it("accetta date reali", () => {
    expect(isValidDateInput("2026-02-28")).toBe(true);
    expect(isValidDateInput("2024-02-29")).toBe(true); // bisestile
  });

  it("rifiuta date impossibili che oggi 'scivolano' al mese successivo", () => {
    expect(isValidDateInput("2026-02-30")).toBe(false);
    expect(isValidDateInput("2026-13-01")).toBe(false);
    expect(isValidDateInput("2026-04-31")).toBe(false);
    expect(isValidDateInput("2025-02-29")).toBe(false); // non bisestile
  });

  it("rifiuta testo non valido", () => {
    expect(isValidDateInput("")).toBe(false);
    expect(isValidDateInput("oggi")).toBe(false);
    expect(isValidDateInput("2026-1-5")).toBe(false);
  });
});

describe("parametri data delle pagine: mai un errore", () => {
  it("restituisce la data se valida, altrimenti il valore di riserva", () => {
    expect(safeDateParam("2026-10-05", "2026-01-01")).toBe("2026-10-05");
    expect(safeDateParam(undefined, "2026-01-01")).toBe("2026-01-01");
    expect(safeDateParam("spazzatura", "2026-01-01")).toBe("2026-01-01");
    expect(safeDateParam("2026-02-30", "2026-01-01")).toBe("2026-01-01");
    // Next.js può passare un array se il parametro è ripetuto (?date=a&date=b)
    expect(safeDateParam(["2026-10-05", "x"], "2026-01-01")).toBe("2026-10-05");
  });

  it("i mesi vanno da 01 a 12", () => {
    expect(safeMonthParam("2026-09", "2026-01")).toBe("2026-09");
    expect(safeMonthParam("2026-13", "2026-01")).toBe("2026-01");
    expect(safeMonthParam("2026-00", "2026-01")).toBe("2026-01");
    expect(safeMonthParam("settembre", "2026-01")).toBe("2026-01");
  });
});
