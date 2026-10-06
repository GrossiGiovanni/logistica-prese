import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  todayInputValue,
  tomorrowInputValue,
  yesterdayInputValue,
  isValidDateInput,
  isValidMonthInput,
  normalizeMonth,
  safeDateInput,
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
