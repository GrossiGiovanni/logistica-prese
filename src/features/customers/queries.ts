import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function listCustomers(branchId: string, search?: string) {
  const where: Prisma.CustomerWhereInput = { branchId };
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { vatNumber: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      {
        addresses: {
          some: {
            OR: [
              { city: { contains: q, mode: "insensitive" } },
              { street: { contains: q, mode: "insensitive" } },
              { province: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }
  return prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { addresses: true, pickups: true } } },
  });
}

export function getCustomer(branchId: string, id: string) {
  return prisma.customer.findFirst({ where: { id, branchId } });
}

/** Cliente con i suoi indirizzi (per la scheda cliente). */
export function getCustomerWithAddresses(branchId: string, id: string) {
  return prisma.customer.findFirst({
    where: { id, branchId },
    include: {
      addresses: {
        orderBy: [{ label: "asc" }, { city: "asc" }],
        include: { _count: { select: { pickups: true } } },
      },
    },
  });
}

/** Clienti con i loro indirizzi — usato nei form delle prese. */
export function listCustomersWithAddresses(branchId: string) {
  return prisma.customer.findMany({
    where: { branchId },
    orderBy: { name: "asc" },
    include: { addresses: { orderBy: { label: "asc" } } },
  });
}
