import type { Prisma, PickupSourceType, TimeWindow } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";
import type { PickupOperationalStatus } from "@/lib/pickup-status";
import { andWhere, pickupStatusWhere, unassignedPickupsWhere } from "@/lib/pickup-where";

export const pickupInclude = {
  customer: { select: { id: true, name: true } },
  address: {
    select: { id: true, label: true, street: true, city: true, province: true, lat: true, lng: true },
  },
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
  /** Stato CALCOLATO (Pianificata / Pronta / Da completare). */
  status?: PickupOperationalStatus;
  sourceType?: PickupSourceType;
  timeWindow?: TimeWindow;
  search?: string;
  unassignedOnly?: boolean;
};

export function listPickups(branchId: string, filters: PickupFilters = {}) {
  // Le prese annullate non compaiono mai (vengono comunque eliminate; restano
  // solo quelle da ricorrenza come blocco anti-rigenerazione, invisibili).
  let where: Prisma.PickupWhereInput = { branchId, cancelledAt: null };

  if (filters.date) where.pickupDate = parseDateOnly(filters.date);
  // Stato calcolato: stessa regola del badge, tradotta in filtro.
  if (filters.status && filters.status !== "ANNULLATA") where = andWhere(where, pickupStatusWhere(filters.status));
  if (filters.unassignedOnly) where.routeStops = { none: {} };
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

export function getPickup(branchId: string, id: string) {
  return prisma.pickup.findFirst({ where: { id, branchId } });
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
export async function listPickupsForMap(branchId: string, date: string): Promise<PickupMapPoint[]> {
  const rows = await prisma.pickup.findMany({
    where: {
      branchId,
      pickupDate: parseDateOnly(date),
      cancelledAt: null,
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
 * Prese da assegnare per una certa data: non annullate e non in un giro, inclusi
 * i recuperi dei giorni precedenti. È la STESSA regola del KPI "Non assegnate"
 * (unassignedPickupsWhere), così lista e KPI coincidono sempre.
 */
export function listUnassignedPickups(branchId: string, date: string, filters: UnassignedFilters = {}) {
  const where: Prisma.PickupWhereInput = unassignedPickupsWhere(branchId, date);
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
