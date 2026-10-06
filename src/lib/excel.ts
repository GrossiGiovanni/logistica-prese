// Utility per gli export Excel.
//
// Le date vanno scritte come VERE date Excel (ordinabili e filtrabili), non come
// testo. Le date del dominio sono a mezzanotte UTC e ExcelJS le converte in
// numero seriale su base UTC: il giorno quindi non slitta per il fuso.
import type ExcelJS from "exceljs";

export const IT_DATE_FORMAT = "dd/mm/yyyy";

/** Valore da scrivere in una cella data (la data stessa, non una stringa). */
export function excelDate(d: Date): Date {
  return d;
}

/** Applica il formato data italiano alle colonne indicate (per chiave). */
export function formatDateColumns(ws: ExcelJS.Worksheet, keys: string[]): void {
  for (const key of keys) ws.getColumn(key).numFmt = IT_DATE_FORMAT;
}
