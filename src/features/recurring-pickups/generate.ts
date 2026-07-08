// Modulo server-only: usa prisma, va importato solo lato server.
import { prisma } from "@/lib/db";
import { parseDateOnly, weekdayKey, yesterdayInputValue, todayInputValue, addDaysInput } from "@/lib/dates";

export type GenerateResult = { created: number; skipped: number };

/**
 * Genera le prese fisse per la data se è oggi o futura (non riscrive lo storico).
 * Idempotente: pensata per essere chiamata all'apertura di pianificazione/dashboard
 * così le ricorrenze con giorni+quantità compaiono senza un click manuale.
 */
// SOSPESO: le prese arrivano tutte dall'import AS400, quindi la generazione
// automatica delle prese fisse è momentaneamente disattivata. Per riattivarla
// rimettere il flag a false (e ripristinare la voce "Prese fisse" nel menu).
const RECURRING_SUSPENDED = true;

export async function ensureRecurringForDate(dateStr: string): Promise<void> {
  if (RECURRING_SUSPENDED) return;
  // Finestra operativa: da ieri a +7 giorni. Evita che la semplice navigazione
  // su date lontane nel futuro crei prese fisse per quelle date.
  if (dateStr < yesterdayInputValue()) return;
  if (dateStr > addDaysInput(todayInputValue(), 7)) return;
  await generateRecurringPickups(dateStr);
}

/**
 * Genera le prese del giorno a partire dalle prese fisse attive.
 *
 * - prende le RecurringPickup attive valide per il giorno della settimana;
 * - per ognuna crea una Pickup con sourceType RECURRING copiando i default;
 * - status READY se i dati minimi (pallet) sono presenti, altrimenti DRAFT;
 * - evita duplicati: salta se esiste già una Pickup per (data + ricorrenza).
 */
export async function generateRecurringPickups(dateStr: string): Promise<GenerateResult> {
  const date = parseDateOnly(dateStr);
  const dayKey = weekdayKey(date); // es. "monday"

  const recurrings = await prisma.recurringPickup.findMany({
    where: { active: true, [dayKey]: true },
  });
  if (recurrings.length === 0) return { created: 0, skipped: 0 };

  // Una sola query per sapere quali ricorrenze hanno già la presa del giorno.
  const existing = await prisma.pickup.findMany({
    where: { pickupDate: date, recurringPickupId: { in: recurrings.map((r) => r.id) } },
    select: { recurringPickupId: true },
  });
  const existingIds = new Set(existing.map((e) => e.recurringPickupId));

  const toCreate = recurrings.filter((r) => !existingIds.has(r.id));
  if (toCreate.length === 0) return { created: 0, skipped: recurrings.length };

  // Creazione in blocco: una sola round-trip al database.
  await prisma.pickup.createMany({
    data: toCreate.map((r) => ({
      pickupDate: date,
      customerId: r.customerId,
      addressId: r.addressId,
      sourceType: "RECURRING" as const,
      // Dati minimi presenti -> READY, altrimenti DRAFT.
      status: r.defaultPallets != null ? ("READY" as const) : ("DRAFT" as const),
      timeWindow: r.defaultTimeWindow,
      timeFrom: r.defaultTimeFrom,
      timeTo: r.defaultTimeTo,
      pallets: r.defaultPallets,
      colli: r.defaultColli,
      weightKg: r.defaultWeightKg,
      volumeM3: r.defaultVolumeM3,
      requiresTailLift: r.defaultRequiresTailLift,
      requiresMotrice: r.defaultRequiresMotrice,
      priority: r.defaultPriority,
      rawNotes: r.defaultNotes,
      recurringPickupId: r.id,
    })),
    skipDuplicates: true,
  });

  return { created: toCreate.length, skipped: recurrings.length - toCreate.length };
}
