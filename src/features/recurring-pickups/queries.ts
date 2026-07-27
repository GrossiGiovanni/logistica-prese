import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const recurringInclude = {
  customer: { select: { id: true, name: true } },
  address: { select: { id: true, label: true, city: true, province: true } },
} satisfies Prisma.RecurringPickupInclude;

export type RecurringWithRelations = Prisma.RecurringPickupGetPayload<{
  include: typeof recurringInclude;
}>;

export function listRecurringPickups(branchId: string) {
  return prisma.recurringPickup.findMany({
    where: { branchId },
    orderBy: [{ active: "desc" }, { customer: { name: "asc" } }],
    include: recurringInclude,
  });
}

export function getRecurringPickup(branchId: string, id: string) {
  return prisma.recurringPickup.findFirst({ where: { id, branchId } });
}
