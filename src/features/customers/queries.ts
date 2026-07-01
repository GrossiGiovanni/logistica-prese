import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export function listCustomers(search?: string) {
  const where: Prisma.CustomerWhereInput = {};
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

export function getCustomer(id: string) {
  return prisma.customer.findUnique({ where: { id } });
}

/** Cliente con i suoi indirizzi (per la scheda cliente). */
export function getCustomerWithAddresses(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      addresses: {
        orderBy: [{ label: "asc" }, { city: "asc" }],
        include: { _count: { select: { pickups: true } } },
      },
    },
  });
}

/** Clienti con i loro indirizzi — usato nei form delle prese. */
export function listCustomersWithAddresses() {
  return prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { addresses: { orderBy: { label: "asc" } } },
  });
}
