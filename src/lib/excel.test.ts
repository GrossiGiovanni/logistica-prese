import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { excelDate, formatDateColumns, IT_DATE_FORMAT } from "./excel";

/** Scrive una riga con una data, salva il file e lo rilegge come farebbe Excel. */
async function roundTrip(d: Date) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Prova");
  ws.columns = [{ header: "Data", key: "date" }];
  ws.addRow({ date: excelDate(d) });
  formatDateColumns(ws, ["date"]);
  const back = new ExcelJS.Workbook();
  await back.xlsx.load((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  return back.worksheets[0].getRow(2).getCell(1);
}

describe("export Excel: le date sono vere date, non testo", () => {
  it("la cella contiene una data (ordinabile e filtrabile in Excel)", async () => {
    const cell = await roundTrip(new Date("2026-07-15T00:00:00.000Z"));
    expect(cell.value).toBeInstanceOf(Date);
  });

  it("il giorno non slitta per il fuso orario", async () => {
    const cell = await roundTrip(new Date("2026-07-15T00:00:00.000Z"));
    expect((cell.value as Date).toISOString().slice(0, 10)).toBe("2026-07-15");
  });

  it("è mostrata in formato italiano gg/mm/aaaa", async () => {
    const cell = await roundTrip(new Date("2026-12-31T00:00:00.000Z"));
    expect(cell.numFmt).toBe(IT_DATE_FORMAT);
  });
});
