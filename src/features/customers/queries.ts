import { prisma } from "@/lib/db";

export function listCustomers() {
  return prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { addresses: true, pickups: true } } },
  });
}

export function getCustomer(id: string) {
  return prisma.customer.findUnique({ where: { id } });
}

/** Clienti con i loro indirizzi — usato nei form delle prese. */
export function listCustomersWithAddresses() {
  return prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { addresses: { orderBy: { label: "asc" } } },
  });
}
