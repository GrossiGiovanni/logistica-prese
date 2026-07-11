import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function listDrivers(search?: string) {
  const where: Prisma.DriverWhereInput = {};
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

export function listActiveDrivers() {
  return prisma.driver.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

export function getDriver(id: string) {
  return prisma.driver.findUnique({ where: { id } });
}
