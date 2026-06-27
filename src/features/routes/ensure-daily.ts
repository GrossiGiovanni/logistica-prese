// Giri giornalieri predefiniti: gli autisti sono fissi e lavorano ogni giorno,
// quindi per ogni giorno lavorativo (lun-ven) esiste già un giro per ciascun
// autista attivo, con il suo mezzo predefinito. L'operatore deve solo assegnare
// le prese. Idempotente: crea solo i giri mancanti, solo per oggi/futuro.

import { prisma } from "@/lib/db";
import { parseDateOnly, weekdayKey, yesterdayInputValue } from "@/lib/dates";

const WORKDAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday"]);

export async function ensureDailyRoutes(dateStr: string): Promise<void> {
  // Finestra operativa: dal giorno prima in poi (non backfilla lo storico più vecchio).
  if (dateStr < yesterdayInputValue()) return;
  if (!WORKDAYS.has(weekdayKey(parseDateOnly(dateStr)))) return; // solo giorni lavorativi

  const date = parseDateOnly(dateStr);

  // Seed una volta sola per giornata: se esistono già giri per quella data non
  // ricreo nulla (così un giro eliminato dall'operatore non ricompare).
  const already = await prisma.route.count({ where: { routeDate: date } });
  if (already > 0) return;

  // Autisti attivi con un mezzo predefinito assegnato.
  const drivers = await prisma.driver.findMany({
    where: { active: true, defaultVehicleId: { not: null } },
    select: { id: true, defaultVehicleId: true },
  });
  if (drivers.length === 0) return;

  await prisma.route.createMany({
    data: drivers.map((d) => ({
      routeDate: date,
      driverId: d.id,
      vehicleId: d.defaultVehicleId,
      shift: "FULL_DAY" as const,
      status: "DRAFT" as const,
    })),
  });
}
