// Modulo server-only: usa prisma, va importato solo lato server.
import { prisma } from "@/lib/db";
import { parseDateOnly, weekdayKey } from "@/lib/dates";

export type GenerateResult = { created: number; skipped: number };

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

  let created = 0;
  let skipped = 0;

  for (const r of recurrings) {
    const existing = await prisma.pickup.findFirst({
      where: { pickupDate: date, recurringPickupId: r.id },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // Dati minimi presenti -> READY, altrimenti DRAFT.
    const hasMinimalData = r.defaultPallets != null;

    await prisma.pickup.create({
      data: {
        pickupDate: date,
        customerId: r.customerId,
        addressId: r.addressId,
        sourceType: "RECURRING",
        status: hasMinimalData ? "READY" : "DRAFT",
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
      },
    });
    created++;
  }

  return { created, skipped };
}
