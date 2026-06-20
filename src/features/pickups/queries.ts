import type { Prisma, PickupStatus, PickupSourceType, TimeWindow } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";

export const pickupInclude = {
  customer: { select: { id: true, name: true } },
  address: { select: { id: true, label: true, street: true, city: true, province: true } },
  routeStops: { select: { routeId: true } },
} satisfies Prisma.PickupInclude;

export type PickupWithRelations = Prisma.PickupGetPayload<{ include: typeof pickupInclude }>;

export type PickupFilters = {
  date?: string;
  status?: PickupStatus;
  sourceType?: PickupSourceType;
  timeWindow?: TimeWindow;
  search?: string;
};

export function listPickups(filters: PickupFilters = {}) {
  const where: Prisma.PickupWhereInput = {};

  if (filters.date) where.pickupDate = parseDateOnly(filters.date);
  if (filters.status) where.status = filters.status;
  if (filters.sourceType) where.sourceType = filters.sourceType;
  if (filters.timeWindow) where.timeWindow = filters.timeWindow;
  if (filters.search) {
    where.OR = [
      { customer: { name: { contains: filters.search, mode: "insensitive" } } },
      { address: { city: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return prisma.pickup.findMany({
    where,
    include: pickupInclude,
    orderBy: [{ pickupDate: "asc" }, { priority: "desc" }, { timeWindow: "asc" }],
  });
}

export function getPickup(id: string) {
  return prisma.pickup.findUnique({ where: { id } });
}

/** Prese assegnabili a un giro per una certa data: READY o DRAFT, non annullate, non già pianificate altrove. */
export function listUnassignedPickups(date: string) {
  return prisma.pickup.findMany({
    where: {
      pickupDate: parseDateOnly(date),
      status: { in: ["READY", "DRAFT"] },
      routeStops: { none: {} },
    },
    include: pickupInclude,
    orderBy: [{ priority: "desc" }, { timeWindow: "asc" }],
  });
}
