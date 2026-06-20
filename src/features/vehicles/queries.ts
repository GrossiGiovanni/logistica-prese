import { prisma } from "@/lib/db";

export function listVehicles() {
  return prisma.vehicle.findMany({
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
