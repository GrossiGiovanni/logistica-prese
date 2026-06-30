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
