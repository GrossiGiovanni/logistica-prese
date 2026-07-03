// Parsing dell'estrazione AS400 (xlsx) per l'import manuale delle prese.
// Tracciato atteso: N. presa | Data | Mittente | Indirizzo | Località | Pro |
//                   plt | note | Colli | Peso | M.cu
// Le intestazioni vengono riconosciute per nome (tolleranti a varianti), quindi
// l'ordine delle colonne può variare tra estrazioni.

import ExcelJS from "exceljs";

export type ParsedRow = {
  rowNumber: number; // riga nel file (per i messaggi di errore)
  numero: string | null; // N. presa normalizzato
  date: string | null; // YYYY-MM-DD
  mittente: string | null;
  street: string | null;
  city: string | null;
  province: string | null;
  pallets: number | null;
  loadingMeters: number | null;
  volumeM3: number | null;
  weightKg: number | null;
  colli: number | null;
  timeWindow: "MORNING" | "AFTERNOON" | "ANYTIME";
  timeFrom: string | null;
  requiresMotrice: boolean;
  rawNotes: string | null;
};

/** Normalizza il numero presa per il confronto duplicati (spazi collassati, maiuscolo). */
export function normalizePickupNumber(v: string | null | undefined): string {
  return (v ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function cellText(value: ExcelJS.CellValue): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value) return String(value.text);
    if ("result" in value) return value.result != null ? String(value.result) : null;
    return null;
  }
  const s = String(value).replace(/\s+/g, " ").trim();
  return s || null;
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  const s = cellText(value);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function cellDate(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = cellText(value);
  if (!s) return null;
  // "2026-08-08..." oppure "08/08/2026"
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const it = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (it) return `${it[3]}-${it[2].padStart(2, "0")}-${it[1].padStart(2, "0")}`;
  return null;
}

/** Quantità estratte da UN singolo testo (i PLT si sommano solo dentro lo stesso testo). */
function parseQuantities(text: string | null) {
  const up = (text ?? "").toUpperCase();
  const out = {
    pallets: null as number | null,
    loadingMeters: null as number | null,
    volumeM3: null as number | null,
    weightKg: null as number | null,
  };
  if (!up) return out;
  const plts = up.match(/(\d+)\s*PLT/g);
  if (plts) out.pallets = plts.reduce((sum, m) => sum + parseInt(m, 10), 0);
  const mtl = up.match(/(\d+(?:[.,]\d+)?)\s*MTL/);
  if (mtl) out.loadingMeters = parseFloat(mtl[1].replace(",", "."));
  const mc = up.match(/(\d+(?:[.,]\d+)?)\s*MC\b/);
  if (mc) out.volumeM3 = parseFloat(mc[1].replace(",", "."));
  const kg = up.match(/(\d+(?:[.,]\d+)?)\s*KG/);
  if (kg) out.weightKg = parseFloat(kg[1].replace(",", "."));
  return out;
}

/**
 * Interpreta i testi semi-strutturati di "plt" e "note".
 * IMPORTANTE anti doppio-conteggio: le quantità vengono lette dalla colonna
 * "plt" con priorità; la colonna "note" è usata solo come riserva se la prima
 * non contiene quel dato. Le due colonne NON si sommano mai tra loro (le
 * estrazioni AS400 spesso ripetono lo stesso testo in entrambe).
 * Orario/fascia e MOTRICE invece vengono cercati in entrambi i testi.
 */
function parseLoadText(pltText: string | null, noteText: string | null) {
  const primary = parseQuantities(pltText);
  const secondary = parseQuantities(noteText);
  const joined = [pltText, noteText].filter(Boolean).join(" - ").toUpperCase();

  const out = {
    pallets: primary.pallets ?? secondary.pallets,
    loadingMeters: primary.loadingMeters ?? secondary.loadingMeters,
    volumeM3: primary.volumeM3 ?? secondary.volumeM3,
    weightKg: primary.weightKg ?? secondary.weightKg,
    timeWindow: "ANYTIME" as "MORNING" | "AFTERNOON" | "ANYTIME",
    timeFrom: null as string | null,
    requiresMotrice: false,
  };
  if (!joined) return out;

  // "ORE 16,00" / "ORE 8" / "ORE 15.30"
  const ore = joined.match(/ORE\s*(\d{1,2})(?:[.,:](\d{1,2}))?/);
  if (ore) {
    const hh = parseInt(ore[1], 10);
    let mm = ore[2] ? parseInt(ore[2], 10) : 0;
    if (ore[2] && ore[2].length === 1) mm *= 10; // "15.3" → 15:30
    if (mm >= 60) mm = 0; // "16,00" → 16:00
    out.timeFrom = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    out.timeWindow = hh < 13 ? "MORNING" : "AFTERNOON";
  } else if (joined.includes("POMERIGG")) {
    out.timeWindow = "AFTERNOON";
  } else if (joined.includes("MATTIN")) {
    out.timeWindow = "MORNING";
  }

  if (joined.includes("MOTRICE")) out.requiresMotrice = true;
  return out;
}

/** Trova l'indice colonna per nome intestazione (tollerante). */
function headerIndex(headers: (string | null)[], ...names: string[]): number {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");
  const targets = names.map(norm);
  return headers.findIndex((h) => h != null && targets.includes(norm(h)));
}

export type ParseResult = {
  rows: ParsedRow[];
  headerError?: string;
};

/** Legge il file xlsx (primo foglio) e restituisce le righe interpretate. */
export async function parseAs400Workbook(buffer: ArrayBuffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], headerError: "Il file non contiene fogli." };

  // Intestazioni dalla prima riga non vuota
  const headerRow = ws.getRow(1);
  const headers: (string | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellText(cell.value);
  });

  const iNumero = headerIndex(headers, "N. presa", "numero presa", "npresa");
  const iData = headerIndex(headers, "Data");
  const iMittente = headerIndex(headers, "Mittente");
  const iIndirizzo = headerIndex(headers, "Indirizzo");
  const iLocalita = headerIndex(headers, "Località", "Localita");
  const iProv = headerIndex(headers, "Pro", "Prov", "Prov.", "Provincia");
  const iPlt = headerIndex(headers, "plt", "pallet", "note1");
  const iNote = headerIndex(headers, "note", "NOTE");
  const iColli = headerIndex(headers, "Colli");
  const iPeso = headerIndex(headers, "Peso");
  const iMcu = headerIndex(headers, "M.cu", "Mcu", "MC", "M.cubi", "Mcubi");

  if (iNumero === -1 || iData === -1 || iMittente === -1) {
    return {
      rows: [],
      headerError:
        "Intestazioni non riconosciute: servono almeno le colonne 'N. presa', 'Data' e 'Mittente'. " +
        `Trovate: ${headers.filter(Boolean).join(", ") || "(nessuna)"}`,
    };
  }

  const rows: ParsedRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // intestazione
    const get = (i: number): ExcelJS.CellValue => (i === -1 ? null : row.getCell(i + 1).value);

    const numeroRaw = cellText(get(iNumero));
    const mittente = cellText(get(iMittente));
    // Salta righe completamente vuote
    if (!numeroRaw && !mittente) return;

    const pltText = cellText(get(iPlt));
    const noteText = cellText(get(iNote));
    const parsed = parseLoadText(pltText, noteText);

    // Testo di plt+note conservato come note operative (dedup se identici:
    // le estrazioni AS400 spesso ripetono lo stesso testo in entrambe le colonne)
    const noteParts = [...new Set([pltText, noteText].filter((t): t is string => Boolean(t)))];
    const rawNotes = noteParts.join(" - ") || null;

    rows.push({
      rowNumber,
      numero: numeroRaw ? normalizePickupNumber(numeroRaw) : null,
      date: cellDate(get(iData)),
      mittente,
      street: cellText(get(iIndirizzo)),
      city: cellText(get(iLocalita)),
      province: cellText(get(iProv)),
      pallets: parsed.pallets,
      loadingMeters: parsed.loadingMeters,
      volumeM3: parsed.volumeM3 ?? cellNumber(get(iMcu)),
      weightKg: parsed.weightKg ?? cellNumber(get(iPeso)),
      colli: cellNumber(get(iColli)) != null ? Math.round(cellNumber(get(iColli))!) : null,
      timeWindow: parsed.timeWindow,
      timeFrom: parsed.timeFrom,
      requiresMotrice: parsed.requiresMotrice,
      rawNotes,
    });
  });

  return { rows };
}
