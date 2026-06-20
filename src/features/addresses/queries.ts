import { prisma } from "@/lib/db";

export function listAddresses() {
  return prisma.address.findMany({
    orderBy: [{ customer: { name: "asc" } }, { label: "asc" }],
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { pickups: true } },
    },
  });
}

export function getAddress(id: string) {
  return prisma.address.findUnique({ where: { id } });
}
