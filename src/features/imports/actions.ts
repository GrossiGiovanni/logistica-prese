"use server";

// Import manuale prese da estrazione AS400 (xlsx) in due fasi:
// 1) previewImport: legge il file e classifica le righe (nuove / già presenti /
//    errori) SENZA scrivere nulla;
// 2) confirmImport: salva solo le prese nuove (clienti/indirizzi creati o
//    riusati), registra lo storico in ImportLog. Non modifica prese esistenti
//    e non crea giri.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseAs400Workbook, normalizePickupNumber, type ParsedRow } from "./parse";

const key = (s: string | null | undefined) =>
  (s ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

export type PreviewRow = ParsedRow & {
  status: "new" | "update" | "existing" | "error";
  reason?: string;
};

export type ImportPreview = {
  ok: boolean;
  error?: string;
  fileName: string;
  totalRows: number;
  newCount: number;
  updateCount: number;
  existingCount: number;
  errorCount: number;
  rows: PreviewRow[];
};

export async function previewImport(formData: FormData): Promise<ImportPreview> {
  const empty = { fileName: "", totalRows: 0, newCount: 0, updateCount: 0, existingCount: 0, errorCount: 0, rows: [] };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Seleziona un file .xlsx.", ...empty };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, error: "Formato non supportato: serve un file .xlsx.", ...empty, fileName: file.name };
  }

  let parsed;
  try {
    parsed = await parseAs400Workbook(await file.arrayBuffer());
  } catch (err) {
    console.warn("[import] parse error:", err);
    return { ok: false, error: "File non leggibile: verifica che sia un xlsx valido.", ...empty, fileName: file.name };
  }
  if (parsed.headerError) {
    return { ok: false, error: parsed.headerError, ...empty, fileName: file.name };
  }

  // Numeri presa già in dashboard (confronto normalizzato)
  const existing = await prisma.pickup.findMany({
    where: { pickupNumber: { not: null } },
    select: { pickupNumber: true },
  });
  const existingNumbers = new Set(existing.map((p) => normalizePickupNumber(p.pickupNumber)));

  const seenInFile = new Set<string>();
  const rows: PreviewRow[] = parsed.rows.map((r) => {
    const missing: string[] = [];
    if (!r.numero) missing.push("numero presa");
    if (!r.date) missing.push("data");
    if (!r.mittente) missing.push("mittente");
    if (!r.street || !r.city) missing.push("indirizzo/località");
    if (missing.length) {
      return { ...r, status: "error", reason: `Dati mancanti: ${missing.join(", ")}` };
    }
    if (seenInFile.has(r.numero!)) {
      return { ...r, status: "existing", reason: "Duplicata nel file (ignorata)" };
    }
    seenInFile.add(r.numero!);
    if (existingNumbers.has(r.numero!)) {
      return { ...r, status: "update", reason: "Già presente: dati aggiornati" };
    }
    return { ...r, status: "new" };
  });

  return {
    ok: true,
    fileName: file.name,
    totalRows: rows.length,
    newCount: rows.filter((r) => r.status === "new").length,
    updateCount: rows.filter((r) => r.status === "update").length,
    existingCount: rows.filter((r) => r.status === "existing").length,
    errorCount: rows.filter((r) => r.status === "error").length,
    rows,
  };
}

/** Svuota lo storico degli import (solo il log: le prese importate restano). */
export async function clearImportLogs(): Promise<void> {
  await prisma.importLog.deleteMany();
  revalidatePath("/importa");
}

export type ImportResult = {
  ok: boolean;
  error?: string;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
};

export async function confirmImport(preview: ImportPreview): Promise<ImportResult> {
  const newRows = preview.rows.filter((r) => r.status === "new");
  const updateRows = preview.rows.filter((r) => r.status === "update");
  if (newRows.length === 0 && updateRows.length === 0) {
    return { ok: false, error: "Nessuna presa da importare o aggiornare.", imported: 0, updated: 0, skipped: 0, errors: 0 };
  }

  // Mappa numero presa (normalizzato) -> presa esistente, per creare o aggiornare.
  const existing = await prisma.pickup.findMany({
    where: { pickupNumber: { not: null } },
    select: {
      id: true,
      pickupNumber: true,
      status: true,
      _count: { select: { routeStops: true } },
    },
  });
  const existingByNumber = new Map(
    existing.map((p) => [normalizePickupNumber(p.pickupNumber), p]),
  );
  const existingNumbers = new Set(existingByNumber.keys());

  // Cache clienti/indirizzi esistenti (dedup per nome / cliente+via+città)
  const customers = await prisma.customer.findMany({ select: { id: true, name: true } });
  const customerByName = new Map(customers.map((c) => [key(c.name), c.id]));
  const addresses = await prisma.address.findMany({
    select: { id: true, customerId: true, street: true, city: true },
  });
  const addressByKey = new Map(
    addresses.map((a) => [`${a.customerId}|${key(a.street)}|${key(a.city)}`, a.id]),
  );

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  // --- AGGIORNAMENTO prese già presenti (numero presa = identificativo univoco).
  // Sovrascrive i dati provenienti da AS400; NON tocca giro, stato PLANNED,
  // cliente/indirizzo. La data viene aggiornata solo se la presa non è in un giro.
  for (const r of updateRows) {
    try {
      const target = existingByNumber.get(r.numero!);
      if (!target) {
        skipped++;
        continue;
      }
      const hasLoad = r.pallets != null || r.loadingMeters != null || r.volumeM3 != null;
      await prisma.pickup.update({
        where: { id: target.id },
        data: {
          pallets: r.pallets,
          colli: r.colli,
          loadingMeters: r.loadingMeters,
          weightKg: r.weightKg,
          volumeM3: r.volumeM3,
          rawNotes: r.rawNotes,
          requiresMotrice: r.requiresMotrice,
          timeWindow: r.timeWindow,
          timeFrom: r.timeFrom,
          ...(target._count.routeStops === 0
            ? { pickupDate: new Date(`${r.date}T00:00:00.000Z`) }
            : {}),
          ...(target.status === "DRAFT" && hasLoad ? { status: "READY" as const } : {}),
        },
      });
      updated++;
    } catch (err) {
      errors++;
      errorDetails.push(`Riga ${r.rowNumber} (${r.numero ?? "?"}): ${err instanceof Error ? err.message : "errore"}`);
    }
  }

  for (const r of newRows) {
    try {
      if (existingNumbers.has(r.numero!)) {
        skipped++;
        continue;
      }
      let customerId = customerByName.get(key(r.mittente));
      if (!customerId) {
        const c = await prisma.customer.create({ data: { name: r.mittente! } });
        customerId = c.id;
        customerByName.set(key(r.mittente), customerId);
      }
      const aKey = `${customerId}|${key(r.street)}|${key(r.city)}`;
      let addressId = addressByKey.get(aKey);
      if (!addressId) {
        const a = await prisma.address.create({
          data: { customerId, street: r.street!, city: r.city!, province: r.province ?? "" },
        });
        addressId = a.id;
        addressByKey.set(aKey, addressId);
      }

      await prisma.pickup.create({
        data: {
          pickupNumber: r.numero!,
          pickupDate: new Date(`${r.date}T00:00:00.000Z`),
          customerId,
          addressId,
          sourceType: "SPOT",
          // Come nel resto della dashboard: READY se c'è un dato di carico, altrimenti bozza.
          status: r.pallets != null || r.loadingMeters != null || r.volumeM3 != null ? "READY" : "DRAFT",
          timeWindow: r.timeWindow,
          timeFrom: r.timeFrom ?? undefined,
          pallets: r.pallets ?? undefined,
          colli: r.colli ?? undefined,
          loadingMeters: r.loadingMeters ?? undefined,
          weightKg: r.weightKg ?? undefined,
          volumeM3: r.volumeM3 ?? undefined,
          requiresMotrice: r.requiresMotrice,
          rawNotes: r.rawNotes ?? undefined,
          internalNotes: `Import AS400: ${preview.fileName}`,
        },
      });
      existingNumbers.add(r.numero!);
      imported++;
    } catch (err) {
      errors++;
      errorDetails.push(`Riga ${r.rowNumber} (${r.numero ?? "?"}): ${err instanceof Error ? err.message : "errore"}`);
    }
  }

  const previewErrors = preview.rows
    .filter((x) => x.status === "error")
    .map((x) => `Riga ${x.rowNumber}: ${x.reason}`);

  await prisma.importLog.create({
    data: {
      fileName: preview.fileName,
      totalRows: preview.totalRows,
      imported,
      updated,
      skipped: skipped + preview.existingCount,
      errors: errors + preview.errorCount,
      errorDetails: [...previewErrors, ...errorDetails].join("\n") || null,
    },
  });

  revalidatePath("/prese");
  revalidatePath("/pianificazione");
  revalidatePath("/dashboard");
  revalidatePath("/importa");

  return { ok: true, imported, updated, skipped: skipped + preview.existingCount, errors: errors + preview.errorCount };
}
