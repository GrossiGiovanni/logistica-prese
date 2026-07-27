import { prisma } from "@/lib/db";

export function listAddresses(branchId: string) {
  return prisma.address.findMany({
    where: { customer: { branchId } },
    orderBy: [{ customer: { name: "asc" } }, { label: "asc" }],
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { pickups: true } },
    },
  });
}

export function getAddress(branchId: string, id: string) {
  return prisma.address.findFirst({ where: { id, customer: { branchId } } });
}
