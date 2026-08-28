// Dati per un singolo quadrante di "Pianificazione Fabio".
// Ogni quadrante replica la logica della Pianificazione standard (prese, giri,
// KPI, pallet, metri, km, warning, stato assegnazione) ma con filtri PROPRI e
// indipendenti (data, filiale, cliente, autista, mezzo, fascia, stato presa,
// prese da assegnare, giro specifico).
//
// Riusa le query/inlcude e le helper esistenti: nessuna business logic nuova.

import type { Prisma, PickupStatus, RouteShift } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/dates";
import { pickupInclude } from "@/features/pickups/queries";
import { routeInclude, type RouteWithRelations } from "@/features/routes/queries";
import {
  routeTotalPallets,
  routeOccupiedMeters,
  findResourceOverlaps,
} from "@/lib/warnings";
import { routeTotalCost } from "@/lib/costs";
import { routeLabel } from "@/lib/labels";

export type QuadrantFilters = {
  branchId: string;
  date: string;
  customerId?: string;
  driverId?: string;
  vehicleId?: string;
  shift?: string; // "" | MORNING | AFTERNOON | FULL_DAY
  status?: string; // "" | READY | DRAFT | PLANNED
  unassignedOnly?: boolean;
  routeId?: string;
};

const SHIFTS = new Set(["MORNING", "AFTERNOON", "FULL_DAY"]);
const STATUSES = new Set(["READY", "DRAFT", "PLANNED"]);

export type QuadrantData = Awaited<ReturnType<typeof getQuadrantData>>;

export async function getQuadrantData(f: QuadrantFilters) {
  const date = parseDateOnly(f.date);

  // ---- Prese (con eventuali filtri) -----------------------------------
  const pickupWhere: Prisma.PickupWhereInput = {
    branchId: f.branchId,
    pickupDate: date,
    status: { not: "CANCELLED" },
  };
  if (f.customerId) pickupWhere.customerId = f.customerId;
  if (f.status && STATUSES.has(f.status)) pickupWhere.status = f.status as PickupStatus;
  if (f.shift === "MORNING") pickupWhere.timeWindow = "MORNING";
  else if (f.shift === "AFTERNOON") pickupWhere.timeWindow = "AFTERNOON";

  // "Solo da assegnare" e i filtri per autista/mezzo/giro agiscono sullo stato
  // di assegnazione: sono mutuamente esclusivi (una presa non assegnata non è in
  // alcun giro), quindi il toggle "da assegnare" ha la precedenza.
  if (f.unassignedOnly) {
    pickupWhere.routeStops = { none: {} };
  } else if (f.driverId || f.vehicleId || f.routeId) {
    pickupWhere.routeStops = {
      some: {
        route: {
          ...(f.driverId ? { driverId: f.driverId } : {}),
          ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
          ...(f.routeId ? { id: f.routeId } : {}),
        },
      },
    };
  }

  // ---- Giri (con eventuali filtri) ------------------------------------
  const routeWhere: Prisma.RouteWhereInput = { branchId: f.branchId, routeDate: date };
  if (f.driverId) routeWhere.driverId = f.driverId;
  if (f.vehicleId) routeWhere.vehicleId = f.vehicleId;
  if (f.shift && SHIFTS.has(f.shift)) routeWhere.shift = f.shift as RouteShift;
  if (f.routeId) routeWhere.id = f.routeId;
  if (f.customerId) routeWhere.stops = { some: { pickup: { customerId: f.customerId } } };

  const [pickups, routes, dayPickups, customers, drivers, vehicles, routeOptionsRaw] =
    await Promise.all([
      prisma.pickup.findMany({
        where: pickupWhere,
        include: pickupInclude,
        orderBy: [{ priority: "desc" }, { timeWindow: "asc" }, { pickupNumber: "asc" }],
      }),
      prisma.route.findMany({
        where: routeWhere,
        include: routeInclude,
        orderBy: [{ shift: "asc" }, { createdAt: "asc" }],
      }),
      // Totali del giorno (non filtrati) per i KPI "prese / da assegnare".
      prisma.pickup.findMany({
        where: { branchId: f.branchId, pickupDate: date, status: { not: "CANCELLED" } },
        select: { status: true, routeStops: { select: { routeId: true } } },
      }),
      prisma.customer.findMany({
        where: { branchId: f.branchId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.driver.findMany({
        where: { branchId: f.branchId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.vehicle.findMany({
        where: { branchId: f.branchId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.route.findMany({
        where: { branchId: f.branchId, routeDate: date },
        include: { driver: { select: { name: true } }, vehicle: { select: { name: true } } },
        orderBy: [{ shift: "asc" }, { createdAt: "asc" }],
      }),
    ]);

  // ---- KPI / riepiloghi ------------------------------------------------
  const dayTotal = dayPickups.length;
  const dayUnassigned = dayPickups.filter(
    (p) => p.routeStops.length === 0 && (p.status === "READY" || p.status === "DRAFT"),
  ).length;

  const palletTot = routes.reduce((s, r) => s + routeTotalPallets(r), 0);
  const metriTot = routes.reduce((s, r) => s + routeOccupiedMeters(r), 0);
  const kmTot = routes.reduce((s, r) => s + (r.km ?? 0), 0);
  const costTot = routes.reduce((s, r) => s + (routeTotalCost(r) ?? 0), 0);

  // Conflitti risorsa tra i giri impegnati (mostrati come warning sui giri).
  const overlapIds = findResourceOverlaps(routes.filter((r) => r.stops.length > 0));

  const routeOptions = routeOptionsRaw.map((r) => ({ id: r.id, label: routeLabel(r) }));

  return {
    pickups,
    routes: routes as RouteWithRelations[],
    kpi: {
      dayTotal,
      dayUnassigned,
      routesCount: routes.length,
      palletTot,
      metriTot,
      kmTot: Math.round(kmTot),
      costTot,
    },
    overlapIds,
    options: { customers, drivers, vehicles, routes: routeOptions },
  };
}
