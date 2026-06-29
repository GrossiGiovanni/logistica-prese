import type { Prisma, PickupStatus, PickupSourceType, TimeWindow } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";

export const pickupInclude = {
  customer: { select: { id: true, name: true } },
  address: { select: { id: true, label: true, street: true, city: true, province: true } },
  routeStops: {
    select: {
      routeId: true,
      route: {
        select: {
          id: true,
          routeDate: true,
          status: true,
          shift: true,
          driver: { select: { name: true } },
          vehicle: { select: { name: true } },
        },
      },
    },
  },
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
      { pickupNumber: { contains: filters.search, mode: "insensitive" } },
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

export type PickupMapPoint = {
  id: string;
  customerName: string;
  city: string;
  province: string;
  timeWindow: TimeWindow;
  pallets: number | null;
  assigned: boolean;
  lat: number;
  lng: number;
};

/** Prese del giorno con coordinate, per la mappa. Esclude annullate e prive di geocodifica. */
export async function listPickupsForMap(date: string): Promise<PickupMapPoint[]> {
  const rows = await prisma.pickup.findMany({
    where: {
      pickupDate: parseDateOnly(date),
      status: { not: "CANCELLED" },
      address: { lat: { not: null }, lng: { not: null } },
    },
    select: {
      id: true,
      timeWindow: true,
      pallets: true,
      customer: { select: { name: true } },
      address: { select: { city: true, province: true, lat: true, lng: true } },
      routeStops: { select: { routeId: true } },
    },
    orderBy: [{ priority: "desc" }, { timeWindow: "asc" }],
  });

  return rows.map((p) => ({
    id: p.id,
    customerName: p.customer.name,
    city: p.address.city,
    province: p.address.province,
    timeWindow: p.timeWindow,
    pallets: p.pallets,
    assigned: p.routeStops.length > 0,
    lat: p.address.lat!,
    lng: p.address.lng!,
  }));
}

export type UnassignedFilters = {
  search?: string;
  timeWindow?: TimeWindow;
  priority?: "NORMAL" | "HIGH" | "MANDATORY";
};

/**
 * Prese assegnabili per una certa data: READY o DRAFT, non annullate, non già
 * pianificate. Include anche le prese **dei giorni precedenti** rimaste non
 * assegnate (pickupDate <= data selezionata), così da poterle recuperare.
 */
export function listUnassignedPickups(date: string, filters: UnassignedFilters = {}) {
  const where: Prisma.PickupWhereInput = {
    pickupDate: { lte: parseDateOnly(date) },
    status: { in: ["READY", "DRAFT"] },
    routeStops: { none: {} },
  };
  if (filters.timeWindow) where.timeWindow = filters.timeWindow;
  if (filters.priority) where.priority = filters.priority;
  if (filters.search) {
    where.OR = [
      { customer: { name: { contains: filters.search, mode: "insensitive" } } },
      { address: { city: { contains: filters.search, mode: "insensitive" } } },
      { pickupNumber: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return prisma.pickup.findMany({
    where,
    include: pickupInclude,
    // Data selezionata per prima, poi i recuperi dei giorni precedenti.
    orderBy: [{ pickupDate: "desc" }, { priority: "desc" }, { timeWindow: "asc" }],
  });
}
