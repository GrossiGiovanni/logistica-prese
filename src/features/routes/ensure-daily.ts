// Giri giornalieri predefiniti: gli autisti sono fissi e lavorano ogni giorno,
// quindi per ogni giorno lavorativo (lun-ven) esiste già un giro per ciascun
// autista attivo, con il suo mezzo predefinito. L'operatore deve solo assegnare
// le prese. Idempotente: crea solo i giri mancanti, solo per oggi/futuro.

import { prisma } from "@/lib/db";
import { parseDateOnly, weekdayKey, todayInputValue } from "@/lib/dates";

const WORKDAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday"]);

export async function ensureDailyRoutes(dateStr: string): Promise<void> {
  if (dateStr < todayInputValue()) return; // non backfilla lo storico
  if (!WORKDAYS.has(weekdayKey(parseDateOnly(dateStr)))) return; // solo giorni lavorativi

  const date = parseDateOnly(dateStr);

  // Autisti attivi con un mezzo predefinito assegnato.
  const drivers = await prisma.driver.findMany({
    where: { active: true, defaultVehicleId: { not: null } },
    select: { id: true, defaultVehicleId: true },
  });
  if (drivers.length === 0) return;

  const existing = await prisma.route.findMany({
    where: { routeDate: date, driverId: { in: drivers.map((d) => d.id) } },
    select: { driverId: true },
  });
  const existingDriverIds = new Set(existing.map((e) => e.driverId));

  const toCreate = drivers.filter((d) => !existingDriverIds.has(d.id));
  if (toCreate.length === 0) return;

  await prisma.route.createMany({
    data: toCreate.map((d) => ({
      routeDate: date,
      driverId: d.id,
      vehicleId: d.defaultVehicleId,
      shift: "FULL_DAY" as const,
      status: "DRAFT" as const,
    })),
  });
}
