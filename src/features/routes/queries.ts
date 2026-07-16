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

export function listRoutes(date?: string) {
  return prisma.route.findMany({
    where: date ? { routeDate: parseDateOnly(date) } : undefined,
    include: routeInclude,
    orderBy: [{ routeDate: "asc" }, { shift: "asc" }, { createdAt: "asc" }],
  });
}

export function getRoute(id: string) {
  return prisma.route.findUnique({ where: { id }, include: routeInclude });
}
