import type { Prisma, VehicleType } from "@prisma/client";
import { prisma } from "@/lib/db";

const VEHICLE_TYPES = ["VAN", "TRUCK", "BILICO", "MOTRICE"] as const;

export function listVehicles(search?: string) {
  const where: Prisma.VehicleWhereInput = {};
  if (search && search.trim()) {
    const q = search.trim();
    // Il tipo è un enum: match per nome tipo scritto in chiaro (es. "motrice").
    const typeMatches = VEHICLE_TYPES.filter((t) => t.includes(q.toUpperCase()));
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { plate: { contains: q, mode: "insensitive" } },
      { owner: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      ...(typeMatches.length > 0 ? [{ vehicleType: { in: typeMatches as VehicleType[] } }] : []),
    ];
  }
  return prisma.vehicle.findMany({
    where,
    orderBy: [{ active: "desc" }, { vehicleType: "asc" }, { name: "asc" }],
  });
}

export function listActiveVehicles() {
  return prisma.vehicle.findMany({
    where: { active: true },
    orderBy: [{ vehicleType: "asc" }, { name: "asc" }],
  });
}

export function getVehicle(id: string) {
  return prisma.vehicle.findUnique({ where: { id } });
}
