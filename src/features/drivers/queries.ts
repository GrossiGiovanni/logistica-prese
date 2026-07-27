import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function listDrivers(branchId: string, search?: string) {
  const where: Prisma.DriverWhereInput = { branchId };
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { defaultVehicle: { is: { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { plate: { contains: q, mode: "insensitive" } },
      ] } } },
    ];
  }
  return prisma.driver.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { defaultVehicle: { select: { id: true, name: true } } },
  });
}

export function listActiveDrivers(branchId: string) {
  return prisma.driver.findMany({
    where: { branchId, active: true },
    orderBy: { name: "asc" },
  });
}

/** Autisti attivi con flag "Autista Eurosarda" (sezione dedicata). */
export function listEurosardaDrivers(branchId: string) {
  return prisma.driver.findMany({
    where: { branchId, active: true, isEurosarda: true },
    orderBy: { name: "asc" },
  });
}

export function getDriver(branchId: string, id: string) {
  return prisma.driver.findFirst({ where: { id, branchId } });
}
