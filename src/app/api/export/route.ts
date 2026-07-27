// Export Excel (.xlsx) di prese e giri, filtrabile per intervallo date.
// /api/export?type=prese&from=YYYY-MM-DD&to=YYYY-MM-DD
// /api/export?type=giri&from=YYYY-MM-DD&to=YYYY-MM-DD

import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { routeInclude } from "@/features/routes/queries";
import {
  routeTotalPallets,
  routeOccupiedMeters,
  routeTotalWeight,
  routeTotalVolume,
  routeResiCount,
} from "@/lib/warnings";
import { routeTotalCost } from "@/lib/costs";
import { routeLabel, routeShiftLabels, pickupStatusLabels, routeStatusLabels } from "@/lib/labels";
import { parseDateOnly, isValidDateInput, toDateInputValue, todayInputValue, addDaysInput } from "@/lib/dates";

export const dynamic = "force-dynamic";

function itDate(d: Date): string {
  return d.toLocaleDateString("it-IT", { timeZone: "UTC" });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") === "giri" ? "giri" : "prese";
  const from = isValidDateInput(sp.get("from") ?? "") ? sp.get("from")! : addDaysInput(todayInputValue(), -30);
  const to = isValidDateInput(sp.get("to") ?? "") ? sp.get("to")! : todayInputValue();
  const range = { gte: parseDateOnly(from), lte: parseDateOnly(to) };

  const wb = new ExcelJS.Workbook();
  wb.creator = "Logistica Prese — Eurosarda";
  const ws = wb.addWorksheet(type === "giri" ? "Giri" : "Prese");

  if (type === "prese") {
    const pickups = await prisma.pickup.findMany({
      where: { pickupDate: range, status: { not: "CANCELLED" } },
      include: {
        customer: { select: { name: true } },
        address: { select: { city: true, province: true } },
        routeStops: {
          select: {
            route: {
              select: { driver: { select: { name: true } }, vehicle: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: [{ pickupDate: "asc" }, { pickupNumber: "asc" }],
    });

    ws.columns = [
      { header: "N. presa", key: "num", width: 18 },
      { header: "Data", key: "date", width: 12 },
      { header: "Cliente", key: "cust", width: 30 },
      { header: "Località", key: "city", width: 22 },
      { header: "Prov", key: "prov", width: 6 },
      { header: "Stato", key: "status", width: 12 },
      { header: "Giro", key: "route", width: 24 },
      { header: "Autista", key: "driver", width: 16 },
      { header: "Mezzo", key: "vehicle", width: 18 },
      { header: "Pallet", key: "plt", width: 8 },
      { header: "Metri lin.", key: "mtl", width: 10 },
      { header: "Colli", key: "colli", width: 8 },
      { header: "Peso (kg)", key: "kg", width: 10 },
      { header: "Volume (m³)", key: "mc", width: 12 },
    ];

    for (const p of pickups) {
      const route = p.routeStops[0]?.route;
      ws.addRow({
        num: p.pickupNumber ?? "",
        date: itDate(p.pickupDate),
        cust: p.customer.name,
        city: p.address.city,
        prov: p.address.province,
        status: pickupStatusLabels[p.status],
        route: route ? `${route.driver?.name ?? "—"} / ${route.vehicle?.name ?? "—"}` : "Non assegnata",
        driver: route?.driver?.name ?? "",
        vehicle: route?.vehicle?.name ?? "",
        plt: p.pallets ?? "",
        mtl: p.loadingMeters ?? "",
        colli: p.colli ?? "",
        kg: p.weightKg ?? "",
        mc: p.volumeM3 ?? "",
      });
    }
  } else {
    const routes = await prisma.route.findMany({
      where: { routeDate: range },
      include: routeInclude,
      orderBy: [{ routeDate: "asc" }, { createdAt: "asc" }],
    });

    ws.columns = [
      { header: "Data", key: "date", width: 12 },
      { header: "Giro (Autista / Mezzo)", key: "label", width: 28 },
      { header: "Autista", key: "driver", width: 16 },
      { header: "Mezzo", key: "vehicle", width: 18 },
      { header: "Fascia", key: "shift", width: 14 },
      { header: "Stato", key: "status", width: 12 },
      { header: "N. ritiri", key: "npick", width: 9 },
      { header: "N. resi", key: "nresi", width: 8 },
      { header: "Pallet", key: "plt", width: 8 },
      { header: "Metri", key: "m", width: 8 },
      { header: "Peso (kg)", key: "kg", width: 10 },
      { header: "Volume (m³)", key: "mc", width: 12 },
      { header: "Km", key: "km", width: 8 },
      { header: "Costo (€)", key: "cost", width: 10 },
    ];

    for (const r of routes) {
      const ritiri = r.stops.filter((s) => s.pickup != null).length;
      ws.addRow({
        date: itDate(r.routeDate),
        label: routeLabel(r),
        driver: r.driver?.name ?? "",
        vehicle: r.vehicle?.name ?? "",
        shift: routeShiftLabels[r.shift],
        status: routeStatusLabels[r.status],
        npick: ritiri,
        nresi: routeResiCount(r),
        plt: routeTotalPallets(r),
        m: routeOccupiedMeters(r),
        kg: Math.round(routeTotalWeight(r)),
        mc: Math.round(routeTotalVolume(r) * 10) / 10,
        km: r.km ?? "",
        cost: routeTotalCost(r) ?? "",
      });
    }
  }

  // Intestazione in grassetto
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE1F5" } };

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `${type}_${from}_${to}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
