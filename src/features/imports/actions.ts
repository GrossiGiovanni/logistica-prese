"use server";

// Import manuale prese da estrazione AS400 (xlsx) in due fasi:
// 1) previewImport: legge il file e classifica le righe (nuove / da aggiornare /
//    già presenti / errori) SENZA scrivere nulla;
// 2) confirmImport: scrive TUTTO in un'unica transazione (o tutto o niente):
//    clienti/indirizzi creati o riusati, prese nuove, aggiornamenti, storico.
//
// Regole (collaudate in merge.ts / parse.test.ts):
//  - identità della presa = anno + numero completo (pickupIdentityKey);
//  - un valore vuoto in arrivo non cancella mai un dato esistente;
//  - la fascia scelta a mano non viene mai modificata;
//  - lo stato non si scrive: è calcolato (giro / dati di carico / annullata).

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/branch";
import { geocodeAddress } from "@/lib/geocode";
import { parseDateOnly, toDateInputValue } from "@/lib/dates";
import { parseAs400Workbook, type ParsedRow } from "./parse";
import { buildExistingPickupUpdate, pickupIdentityKey } from "./merge";

const key = (s: string | null | undefined) =>
  (s ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

export type PreviewRow = ParsedRow & {
  status: "new" | "update" | "existing" | "error";
  reason?: string;
};

export type ImportMode = "operativo" | "aggiornamento";

export type ImportPreview = {
  ok: boolean;
  error?: string;
  mode: ImportMode;
  fileName: string;
  totalRows: number;
  newCount: number;
  updateCount: number;
  existingCount: number;
  errorCount: number;
  rows: PreviewRow[];
};

/** Prese con numero della filiale, indicizzate per identità (anno + numero). */
async function existingPickupsByKey(branchId: string) {
  const existing = await prisma.pickup.findMany({
    where: { branchId, pickupNumber: { not: null } },
    select: {
      id: true,
      pickupNumber: true,
      pickupDate: true,
      pallets: true,
      loadingMeters: true,
      rawNotes: true,
      _count: { select: { routeStops: true } },
    },
  });
  const byKey = new Map<string, (typeof existing)[number][]>();
  for (const p of existing) {
    const k = pickupIdentityKey(p.pickupNumber, toDateInputValue(p.pickupDate));
    if (!k) continue;
    byKey.set(k, [...(byKey.get(k) ?? []), p]);
  }
  return byKey;
}

export async function previewImport(formData: FormData): Promise<ImportPreview> {
  const branchId = await requireBranchId();
  const mode: ImportMode = formData.get("mode") === "aggiornamento" ? "aggiornamento" : "operativo";
  const empty = { mode, fileName: "", totalRows: 0, newCount: 0, updateCount: 0, existingCount: 0, errorCount: 0, rows: [] };
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

  const existingByKey = await existingPickupsByKey(branchId);

  const seenInFile = new Set<string>();
  const rows: PreviewRow[] = parsed.rows.map((r) => {
    if (!r.numero) {
      return { ...r, status: "error", reason: "Dati mancanti: numero presa" };
    }
    const k = pickupIdentityKey(r.numero, r.date);
    if (!k) {
      return { ...r, status: "error", reason: "Numero presa senza anno e senza data: impossibile identificarla" };
    }
    if (mode === "operativo") {
      const missing: string[] = [];
      if (!r.date) missing.push("data");
      if (!r.mittente) missing.push("mittente");
      if (!r.street || !r.city) missing.push("indirizzo/località");
      if (missing.length) {
        return { ...r, status: "error", reason: `Dati mancanti: ${missing.join(", ")}` };
      }
    }
    if (seenInFile.has(k)) {
      return { ...r, status: "existing", reason: "Duplicata nel file (ignorata)" };
    }
    seenInFile.add(k);
    const matches = existingByKey.get(k) ?? [];
    if (matches.length > 1) {
      // Mai aggiornare "a caso" una delle due: va sistemato a mano.
      return { ...r, status: "error", reason: `Numero presa presente ${matches.length} volte a sistema: verificare` };
    }
    if (matches.length === 1) {
      return {
        ...r,
        status: "update",
        reason: mode === "aggiornamento" ? "Aggiorna peso/volume/colli" : "Già presente: dati aggiornati",
      };
    }
    // In modalità aggiornamento le prese non presenti a sistema vengono ignorate
    // (questo import non crea mai nuove prese da pianificare).
    if (mode === "aggiornamento") {
      return { ...r, status: "existing", reason: "Non presente a sistema (ignorata)" };
    }
    return { ...r, status: "new" };
  });

  return {
    ok: true,
    mode,
    fileName: file.name,
    totalRows: rows.length,
    newCount: rows.filter((r) => r.status === "new").length,
    updateCount: rows.filter((r) => r.status === "update").length,
    existingCount: rows.filter((r) => r.status === "existing").length,
    errorCount: rows.filter((r) => r.status === "error").length,
    rows,
  };
}

/** Svuota lo storico degli import della filiale corrente (le prese restano). */
export async function clearImportLogs(): Promise<void> {
  const branchId = await requireBranchId();
  await prisma.importLog.deleteMany({ where: { branchId } });
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
  const branchId = await requireBranchId();
  const newRows = preview.rows.filter((r) => r.status === "new");
  const updateRows = preview.rows.filter((r) => r.status === "update");
  if (newRows.length === 0 && updateRows.length === 0) {
    return { ok: false, error: "Nessuna presa da importare o aggiornare.", imported: 0, updated: 0, skipped: 0, errors: 0 };
  }
  const aggiornamento = preview.mode === "aggiornamento";

  // Stato attuale riletto al momento della conferma (non quello dell'anteprima).
  const existingByKey = await existingPickupsByKey(branchId);
  const customers = await prisma.customer.findMany({ where: { branchId }, select: { id: true, name: true } });
  const customerByName = new Map(customers.map((c) => [key(c.name), c.id]));
  const addresses = await prisma.address.findMany({
    where: { customer: { branchId } },
    select: { id: true, customerId: true, street: true, city: true },
  });
  const addressByKey = new Map(addresses.map((a) => [`${a.customerId}|${key(a.street)}|${key(a.city)}`, a.id]));

  // Geocodifica PRIMA della transazione (chiamate di rete lente: tenerle fuori
  // evita di tenere aperta la transazione). Best-effort, una volta per indirizzo.
  const coordsByAddress = new Map<string, { lat: number; lng: number } | null>();
  for (const r of newRows) {
    const aKey = `${key(r.mittente)}|${key(r.street)}|${key(r.city)}`;
    const custId = customerByName.get(key(r.mittente));
    const known = custId && addressByKey.has(`${custId}|${key(r.street)}|${key(r.city)}`);
    if (known || coordsByAddress.has(aKey) || !r.street || !r.city) continue;
    coordsByAddress.set(aKey, await geocodeAddress({ street: r.street, city: r.city, province: r.province ?? "" }));
  }

  const previewErrors = preview.rows
    .filter((x) => x.status === "error")
    .map((x) => `Riga ${x.rowNumber}: ${x.reason}`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let currentRow: PreviewRow | null = null;

  try {
    await prisma.$transaction(
      async (tx) => {
        // --- Aggiornamento prese già presenti ---------------------------
        for (const r of updateRows) {
          currentRow = r;
          const matches = existingByKey.get(pickupIdentityKey(r.numero, r.date) ?? "") ?? [];
          if (matches.length !== 1) {
            skipped++;
            continue;
          }
          const target = matches[0];
          const data = buildExistingPickupUpdate(
            {
              pallets: target.pallets,
              loadingMeters: target.loadingMeters,
              rawNotes: target.rawNotes,
              routeStopsCount: target._count.routeStops,
            },
            r,
            { aggiornamento },
          ) as Prisma.PickupUpdateInput;
          if (Object.keys(data).length > 0) await tx.pickup.update({ where: { id: target.id }, data });
          updated++;
        }

        // --- Prese nuove -------------------------------------------------
        for (const r of newRows) {
          currentRow = r;
          const k = pickupIdentityKey(r.numero, r.date);
          if (!k || existingByKey.has(k)) {
            skipped++;
            continue;
          }
          let customerId = customerByName.get(key(r.mittente));
          if (!customerId) {
            const c = await tx.customer.create({ data: { name: r.mittente!, branchId } });
            customerId = c.id;
            customerByName.set(key(r.mittente), customerId);
          }
          const aKey = `${customerId}|${key(r.street)}|${key(r.city)}`;
          let addressId = addressByKey.get(aKey);
          if (!addressId) {
            const coords = coordsByAddress.get(`${key(r.mittente)}|${key(r.street)}|${key(r.city)}`) ?? null;
            const a = await tx.address.create({
              data: {
                customerId,
                street: r.street!,
                city: r.city!,
                province: r.province ?? "",
                ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
              },
            });
            addressId = a.id;
            addressByKey.set(aKey, addressId);
          }

          await tx.pickup.create({
            data: {
              branchId,
              pickupNumber: r.numero!,
              pickupDate: parseDateOnly(r.date!),
              customerId,
              addressId,
              sourceType: "SPOT",
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
          existingByKey.set(k, []);
          imported++;
        }
        currentRow = null;

        await tx.importLog.create({
          data: {
            branchId,
            fileName: preview.fileName,
            totalRows: preview.totalRows,
            imported,
            updated,
            skipped: skipped + preview.existingCount,
            errors: preview.errorCount,
            errorDetails: previewErrors.join("\n") || null,
          },
        });
      },
      { timeout: 120_000, maxWait: 15_000 },
    );
  } catch (err) {
    // Tutto annullato: nessuna presa a metà. Resta traccia nello storico.
    const r = currentRow as PreviewRow | null;
    const where = r ? `riga ${r.rowNumber} (${r.numero ?? "?"})` : "salvataggio";
    const message = err instanceof Error ? err.message : "errore";
    console.warn("[import] transazione annullata:", err);
    await prisma.importLog.create({
      data: {
        branchId,
        fileName: preview.fileName,
        totalRows: preview.totalRows,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: preview.totalRows,
        errorDetails: [`Import annullato (nessuna modifica salvata) — errore alla ${where}: ${message}`, ...previewErrors].join("\n"),
      },
    });
    revalidatePath("/importa");
    return {
      ok: false,
      error: `Import annullato: nessuna modifica salvata. Errore alla ${where}.`,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: preview.totalRows,
    };
  }

  revalidatePath("/prese");
  revalidatePath("/pianificazione");
  revalidatePath("/dashboard");
  revalidatePath("/importa");

  return { ok: true, imported, updated, skipped: skipped + preview.existingCount, errors: preview.errorCount };
}
