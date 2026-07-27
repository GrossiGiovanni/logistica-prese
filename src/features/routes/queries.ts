import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";

export const routeInclude = {
  driver: true,
  vehicle: true,
  stops: {
    orderBy: { sequence: "asc" },
    include: {
      pickup: {
        include: {
          customer: { select: { id: true, name: true } },
          address: {
            select: { id: true, label: true, street: true, city: true, province: true, lat: true, lng: true },
          },
        },
      },
      reso: {
        include: {
          customer: { select: { id: true, name: true } },
          address: {
            select: { id: true, label: true, street: true, city: true, province: true, lat: true, lng: true },
          },
        },
      },
    },
  },
} satisfies Prisma.RouteInclude;

export type RouteWithRelations = Prisma.RouteGetPayload<{ include: typeof routeInclude }>;

export function listRoutes(branchId: string, date?: string) {
  return prisma.route.findMany({
    where: { branchId, ...(date ? { routeDate: parseDateOnly(date) } : {}) },
    include: routeInclude,
    orderBy: [{ routeDate: "asc" }, { shift: "asc" }, { createdAt: "asc" }],
  });
}

export function getRoute(branchId: string, id: string) {
  return prisma.route.findFirst({ where: { id, branchId }, include: routeInclude });
}
