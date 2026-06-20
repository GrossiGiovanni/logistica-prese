import { prisma } from "@/lib/db";

export function listDrivers() {
  return prisma.driver.findMany({
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
