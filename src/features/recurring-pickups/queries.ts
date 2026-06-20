import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const recurringInclude = {
  customer: { select: { id: true, name: true } },
  address: { select: { id: true, label: true, city: true, province: true } },
} satisfies Prisma.RecurringPickupInclude;

export type RecurringWithRelations = Prisma.RecurringPickupGetPayload<{
  include: typeof recurringInclude;
}>;

export function listRecurringPickups() {
  return prisma.recurringPickup.findMany({
    orderBy: [{ active: "desc" }, { customer: { name: "asc" } }],
    include: recurringInclude,
  });
}

export function getRecurringPickup(id: string) {
  return prisma.recurringPickup.findUnique({ where: { id } });
}
