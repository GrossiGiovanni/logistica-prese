import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";
import { hasMissingData } from "@/lib/warnings";
import { pickupInclude } from "@/features/pickups/queries";
import { routeInclude } from "@/features/routes/queries";

/**
 * Statistiche operative del giorno, riutilizzate da /dashboard e /pianificazione.
 * Le prese annullate sono escluse dai conteggi.
 */
export async function getDailyStats(dateStr: string) {
  const date = parseDateOnly(dateStr);

  const [pickups, routes] = await Promise.all([
    prisma.pickup.findMany({
      where: { pickupDate: date, status: { not: "CANCELLED" } },
      include: pickupInclude,
      orderBy: [{ priority: "desc" }, { timeWindow: "asc" }],
    }),
    prisma.route.findMany({
      where: { routeDate: date },
      include: routeInclude,
      orderBy: [{ shift: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const total = pickups.length;
  const recurring = pickups.filter((p) => p.sourceType === "RECURRING").length;
  const spot = pickups.filter((p) => p.sourceType === "SPOT").length;
  const unassigned = pickups.filter(
    (p) => p.routeStops.length === 0 && (p.status === "READY" || p.status === "DRAFT"),
  ).length;
  const missingData = pickups.filter((p) => hasMissingData(p)).length;

  const usedVehicleIds = new Set(
    routes.map((r) => r.vehicleId).filter((v): v is string => Boolean(v)),
  );
  const motriciUsed = routes.filter((r) => r.vehicle?.vehicleType === "MOTRICE").length;

  return {
    pickups,
    routes,
    kpi: {
      total,
      recurring,
      spot,
      unassigned,
      missingData,
      routesCount: routes.length,
      vehiclesUsed: usedVehicleIds.size,
      motriciUsed,
    },
  };
}
