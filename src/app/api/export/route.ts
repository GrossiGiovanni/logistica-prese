// Export Excel (.xlsx), sempre limitato alla filiale corrente.
// /api/export?type=prese&from=YYYY-MM-DD&to=YYYY-MM-DD
// /api/export?type=giri&from=YYYY-MM-DD&to=YYYY-MM-DD
// /api/export?type=giornata&date=YYYY-MM-DD   — dettaglio operativo di TUTTI i
//                                               giri della giornata (magazzino)
// /api/export?type=carichi&from=&to=&carrier= — carichi manuali
//
// L'export "giri" produce un file multi-foglio:
//   1) Riepilogo giri     — una riga per giro
//   2) Dettaglio prese eseguite — una riga per presa (ritiro) assegnata a un giro
//   3) Dettaglio resi     — una riga per reso assegnato a un giro (separato dalle
//                            prese: i quantitativi dei resi NON si sommano ai ritiri)
//   4) Costi e km         — km e costi per giro e per trazione Eurosarda
// I fogli sono unici e filtrabili (per autista, data, cliente, mezzo, filiale):
// nessun foglio separato per autista. In futuro si potrà aggiungere un'opzione
// "crea fogli separati per autista" (es. ?perDriver=1).

import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getCurrentBranchId } from "@/lib/branch";
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
import { parseDateOnly, isValidDateInput, todayInputValue, addDaysInput } from "@/lib/dates";

export const dynamic = "force-dynamic";

function itDate(d: Date): string {
  return d.toLocaleDateString("it-IT", { timeZone: "UTC" });
}

/** Intestazione in grassetto su sfondo azzurro chiaro. */
function styleHeader(ws: ExcelJS.Worksheet): void {
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE1F5" } };
}

export async function GET(request: NextRequest) {
  const branchId = await getCurrentBranchId();
  if (!branchId) {
    return new NextResponse("Nessuna filiale selezionata.", { status: 400 });
  }
  const sp = request.nextUrl.searchParams;
  const rawType = sp.get("type");
  const type =
    rawType === "giri" || rawType === "giornata" || rawType === "carichi" ? rawType : "prese";
  const from = isValidDateInput(sp.get("from") ?? "") ? sp.get("from")! : addDaysInput(todayInputValue(), -30);
  const to = isValidDateInput(sp.get("to") ?? "") ? sp.get("to")! : todayInputValue();
  const range = { gte: parseDateOnly(from), lte: parseDateOnly(to) };
  let fileName = `${type}_${from}_${to}.xlsx`;

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
  const branchName = branch?.name ?? "—";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Logistica Prese — Eurosarda";

  if (type === "prese") {
    const ws = wb.addWorksheet("Prese");
    const pickups = await prisma.pickup.findMany({
      where: { branchId, pickupDate: range, status: { not: "CANCELLED" } },
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
      { header: "Filiale", key: "branch", width: 12 },
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
        branch: branchName,
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

    styleHeader(ws);
  } else if (type === "giornata") {
    // ---- Dettaglio operativo di TUTTI i giri della giornata (per il magazzino) ----
    const day = isValidDateInput(sp.get("date") ?? "") ? sp.get("date")! : todayInputValue();
    const routes = await prisma.route.findMany({
      where: { branchId, routeDate: parseDateOnly(day) },
      include: routeInclude,
      orderBy: [{ shift: "asc" }, { createdAt: "asc" }],
    });

    // Foglio 1: un riepilogo per ogni giro della giornata.
    const wsSum = wb.addWorksheet("Giri della giornata");
    wsSum.columns = [
      { header: "Data", key: "date", width: 12 },
      { header: "Filiale", key: "branch", width: 12 },
      { header: "Giro", key: "label", width: 28 },
      { header: "Autista", key: "driver", width: 16 },
      { header: "Mezzo", key: "vehicle", width: 18 },
      { header: "Fascia", key: "shift", width: 14 },
      { header: "Stato", key: "status", width: 12 },
      { header: "N. prese", key: "npick", width: 9 },
      { header: "N. resi", key: "nresi", width: 8 },
      { header: "Pallet", key: "plt", width: 9 },
      { header: "Metri lin.", key: "m", width: 11 },
      { header: "Peso (kg)", key: "kg", width: 11 },
      { header: "Volume (m³)", key: "mc", width: 12 },
      { header: "Km", key: "km", width: 8 },
    ];
    for (const r of routes) {
      wsSum.addRow({
        date: itDate(r.routeDate),
        branch: branchName,
        label: routeLabel(r),
        driver: r.driver?.name ?? "",
        vehicle: r.vehicle?.name ?? "",
        shift: routeShiftLabels[r.shift],
        status: routeStatusLabels[r.status],
        npick: r.stops.filter((s) => s.pickup != null).length,
        nresi: routeResiCount(r),
        plt: routeTotalPallets(r),
        m: routeOccupiedMeters(r),
        kg: Math.round(routeTotalWeight(r)),
        mc: Math.round(routeTotalVolume(r) * 10) / 10,
        km: r.km ?? "",
      });
    }
    styleHeader(wsSum);

    // Foglio 2: clienti/prese ritirati, raggruppati per giro e in ordine di fermata.
    const wsPick = wb.addWorksheet("Clienti ritirati");
    wsPick.columns = [
      { header: "Data giro", key: "date", width: 12 },
      { header: "Giro", key: "label", width: 28 },
      { header: "Autista", key: "driver", width: 16 },
      { header: "Mezzo", key: "vehicle", width: 18 },
      { header: "Fascia", key: "shift", width: 14 },
      { header: "Ordine", key: "seq", width: 8 },
      { header: "N. presa", key: "num", width: 20 },
      { header: "Cliente", key: "cust", width: 32 },
      { header: "Indirizzo", key: "street", width: 34 },
      { header: "Località", key: "city", width: 22 },
      { header: "Prov", key: "prov", width: 6 },
      { header: "Pallet", key: "plt", width: 9 },
      { header: "Metri lin.", key: "mtl", width: 11 },
      { header: "Colli", key: "colli", width: 8 },
      { header: "Peso (kg)", key: "kg", width: 11 },
      { header: "Volume (m³)", key: "mc", width: 12 },
      { header: "Note", key: "notes", width: 38 },
    ];
    for (const r of routes) {
      for (const s of r.stops) {
        const p = s.pickup;
        if (!p) continue;
        wsPick.addRow({
          date: itDate(r.routeDate),
          label: routeLabel(r),
          driver: r.driver?.name ?? "",
          vehicle: r.vehicle?.name ?? "",
          shift: routeShiftLabels[r.shift],
          seq: s.sequence,
          num: p.pickupNumber ?? "",
          cust: p.customer.name,
          street: p.address.street,
          city: p.address.city,
          prov: p.address.province,
          plt: p.pallets ?? "",
          mtl: p.loadingMeters ?? "",
          colli: p.colli ?? "",
          kg: p.weightKg ?? "",
          mc: p.volumeM3 ?? "",
          notes: p.rawNotes ?? "",
        });
      }
    }
    styleHeader(wsPick);

    // Foglio 3: resi della giornata (quantitativi separati dai ritiri).
    const resiRows = routes.flatMap((r) =>
      r.stops.filter((s) => s.reso != null).map((s) => ({ r, s })),
    );
    if (resiRows.length > 0) {
      const wsR = wb.addWorksheet("Resi");
      wsR.columns = [
        { header: "Data giro", key: "date", width: 12 },
        { header: "Giro", key: "label", width: 28 },
        { header: "Autista", key: "driver", width: 16 },
        { header: "Ordine", key: "seq", width: 8 },
        { header: "N. distinta", key: "num", width: 20 },
        { header: "Cliente", key: "cust", width: 32 },
        { header: "Indirizzo", key: "street", width: 34 },
        { header: "Località", key: "city", width: 24 },
        { header: "Resi", key: "resi", width: 8 },
        { header: "Pallet", key: "plt", width: 9 },
        { header: "Colli", key: "colli", width: 8 },
        { header: "Note", key: "notes", width: 38 },
      ];
      for (const { r, s } of resiRows) {
        const reso = s.reso!;
        wsR.addRow({
          date: itDate(r.routeDate),
          label: routeLabel(r),
          driver: r.driver?.name ?? "",
          seq: s.sequence,
          num: reso.distintaNumber ?? "",
          cust: reso.customer.name,
          street: reso.address?.street ?? "",
          city: reso.address ? `${reso.address.city} (${reso.address.province})` : "",
          resi: reso.resiCount ?? "",
          plt: reso.pallets ?? "",
          colli: reso.colli ?? "",
          notes: reso.notes ?? "",
        });
      }
      styleHeader(wsR);
    }

    fileName = `giri_giornata_${day}.xlsx`;
  } else if (type === "carichi") {
    // ---- Carichi manuali (indipendenti da prese e giri) ----
    const carrier = (sp.get("carrier") ?? "").trim();
    const carichi = await prisma.carico.findMany({
      where: {
        branchId,
        loadDate: range,
        ...(carrier ? { carrier: { contains: carrier, mode: "insensitive" as const } } : {}),
      },
      orderBy: [{ loadDate: "asc" }, { createdAt: "asc" }],
    });

    const ws = wb.addWorksheet("Carichi");
    ws.columns = [
      { header: "Data", key: "date", width: 12 },
      { header: "Filiale", key: "branch", width: 12 },
      { header: "Vettore", key: "carrier", width: 26 },
      { header: "Targa", key: "plate", width: 12 },
      { header: "Destinazione", key: "dest", width: 26 },
      { header: "Riferimento", key: "ref", width: 18 },
      { header: "Pallet", key: "plt", width: 9 },
      { header: "Colli", key: "colli", width: 8 },
      { header: "Peso (kg)", key: "kg", width: 11 },
      { header: "Volume (m³)", key: "mc", width: 12 },
      { header: "Note di carico", key: "notes", width: 40 },
    ];
    for (const c of carichi) {
      ws.addRow({
        date: itDate(c.loadDate),
        branch: branchName,
        carrier: c.carrier,
        plate: c.plate ?? "",
        dest: c.destination ?? "",
        ref: c.reference ?? "",
        plt: c.pallets ?? "",
        colli: c.colli ?? "",
        kg: c.weightKg ?? "",
        mc: c.volumeM3 ?? "",
        notes: c.notes ?? "",
      });
    }
    styleHeader(ws);
  } else {
    const [routes, tractions] = await Promise.all([
      prisma.route.findMany({
        where: { branchId, routeDate: range },
        include: routeInclude,
        orderBy: [{ routeDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.traction.findMany({
        where: { branchId, tractionDate: range },
        include: { driver: { select: { name: true } } },
        orderBy: [{ tractionDate: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    // ---- Foglio 1: Riepilogo giri (una riga per giro) --------------------
    const wsSummary = wb.addWorksheet("Riepilogo giri");
    wsSummary.columns = [
      { header: "Data", key: "date", width: 12 },
      { header: "Filiale", key: "branch", width: 12 },
      { header: "Giro", key: "label", width: 26 },
      { header: "Autista", key: "driver", width: 16 },
      { header: "Mezzo", key: "vehicle", width: 18 },
      { header: "Fascia", key: "shift", width: 14 },
      { header: "N. prese", key: "npick", width: 9 },
      { header: "N. resi", key: "nresi", width: 8 },
      { header: "Pallet tot.", key: "plt", width: 10 },
      { header: "Metri lin. tot.", key: "m", width: 13 },
      { header: "Peso (kg)", key: "kg", width: 10 },
      { header: "Volume (m³)", key: "mc", width: 12 },
      { header: "Km", key: "km", width: 8 },
      { header: "Costo (€)", key: "cost", width: 10 },
      { header: "Stato", key: "status", width: 12 },
    ];
    for (const r of routes) {
      const ritiri = r.stops.filter((s) => s.pickup != null).length;
      wsSummary.addRow({
        date: itDate(r.routeDate),
        branch: branchName,
        label: routeLabel(r),
        driver: r.driver?.name ?? "",
        vehicle: r.vehicle?.name ?? "",
        shift: routeShiftLabels[r.shift],
        npick: ritiri,
        nresi: routeResiCount(r),
        plt: routeTotalPallets(r),
        m: routeOccupiedMeters(r),
        kg: Math.round(routeTotalWeight(r)),
        mc: Math.round(routeTotalVolume(r) * 10) / 10,
        km: r.km ?? "",
        cost: routeTotalCost(r) ?? "",
        status: routeStatusLabels[r.status],
      });
    }
    styleHeader(wsSummary);

    // ---- Foglio 2: Dettaglio prese eseguite (una riga per presa) ---------
    const wsPickups = wb.addWorksheet("Dettaglio prese eseguite");
    wsPickups.columns = [
      { header: "Data giro", key: "date", width: 12 },
      { header: "Filiale", key: "branch", width: 12 },
      { header: "Giro", key: "label", width: 26 },
      { header: "Autista", key: "driver", width: 16 },
      { header: "Mezzo", key: "vehicle", width: 18 },
      { header: "Seq.", key: "seq", width: 6 },
      { header: "N. presa", key: "num", width: 18 },
      { header: "Cliente", key: "cust", width: 30 },
      { header: "Località", key: "city", width: 22 },
      { header: "Indirizzo", key: "street", width: 30 },
      { header: "Pallet", key: "plt", width: 8 },
      { header: "Metri lin.", key: "mtl", width: 10 },
      { header: "Colli", key: "colli", width: 8 },
      { header: "Peso (kg)", key: "kg", width: 10 },
      { header: "Volume (m³)", key: "mc", width: 12 },
      { header: "Note", key: "notes", width: 30 },
      { header: "Stato presa", key: "status", width: 12 },
    ];
    for (const r of routes) {
      for (const s of r.stops) {
        const p = s.pickup;
        if (!p) continue;
        wsPickups.addRow({
          date: itDate(r.routeDate),
          branch: branchName,
          label: routeLabel(r),
          driver: r.driver?.name ?? "",
          vehicle: r.vehicle?.name ?? "",
          seq: s.sequence,
          num: p.pickupNumber ?? "",
          cust: p.customer.name,
          city: `${p.address.city} (${p.address.province})`,
          street: p.address.street,
          plt: p.pallets ?? "",
          mtl: p.loadingMeters ?? "",
          colli: p.colli ?? "",
          kg: p.weightKg ?? "",
          mc: p.volumeM3 ?? "",
          notes: p.rawNotes ?? "",
          status: pickupStatusLabels[p.status],
        });
      }
    }
    styleHeader(wsPickups);

    // ---- Foglio 3: Dettaglio resi (una riga per reso, separato dai ritiri) --
    const wsResi = wb.addWorksheet("Dettaglio resi");
    wsResi.columns = [
      { header: "Data giro", key: "date", width: 12 },
      { header: "Filiale", key: "branch", width: 12 },
      { header: "Giro", key: "label", width: 26 },
      { header: "Autista", key: "driver", width: 16 },
      { header: "Mezzo", key: "vehicle", width: 18 },
      { header: "Seq.", key: "seq", width: 6 },
      { header: "N. distinta", key: "num", width: 18 },
      { header: "Cliente", key: "cust", width: 30 },
      { header: "Località", key: "city", width: 22 },
      { header: "Indirizzo", key: "street", width: 30 },
      { header: "Resi", key: "resi", width: 8 },
      { header: "Pallet", key: "plt", width: 8 },
      { header: "Colli", key: "colli", width: 8 },
      { header: "Peso (kg)", key: "kg", width: 10 },
      { header: "Volume (m³)", key: "mc", width: 12 },
      { header: "Note", key: "notes", width: 30 },
    ];
    for (const r of routes) {
      for (const s of r.stops) {
        const reso = s.reso;
        if (!reso) continue;
        wsResi.addRow({
          date: itDate(r.routeDate),
          branch: branchName,
          label: routeLabel(r),
          driver: r.driver?.name ?? "",
          vehicle: r.vehicle?.name ?? "",
          seq: s.sequence,
          num: reso.distintaNumber ?? "",
          cust: reso.customer.name,
          city: reso.address ? `${reso.address.city} (${reso.address.province})` : "",
          street: reso.address?.street ?? "",
          resi: reso.resiCount ?? "",
          plt: reso.pallets ?? "",
          colli: reso.colli ?? "",
          kg: reso.weightKg ?? "",
          mc: reso.volumeM3 ?? "",
          notes: reso.notes ?? "",
        });
      }
    }
    styleHeader(wsResi);

    // ---- Foglio 4: Costi e km (giri + trazioni Eurosarda) ----------------
    const wsCosts = wb.addWorksheet("Costi e km");
    wsCosts.columns = [
      { header: "Data", key: "date", width: 12 },
      { header: "Filiale", key: "branch", width: 12 },
      { header: "Tipo", key: "kind", width: 12 },
      { header: "Descrizione", key: "desc", width: 34 },
      { header: "Autista", key: "driver", width: 16 },
      { header: "Mezzo / Targa", key: "vehicle", width: 18 },
      { header: "Km", key: "km", width: 8 },
      { header: "Costo (€)", key: "cost", width: 10 },
    ];
    // Righe unificate (giri + trazioni), ordinate per data così è facile
    // sommare per giornata con un filtro/pivot in Excel.
    type CostEntry = {
      date: Date;
      kind: string;
      desc: string;
      driver: string;
      vehicle: string;
      km: number | null;
      cost: number | null;
    };
    const entries: CostEntry[] = [
      ...routes.map((r) => ({
        date: r.routeDate,
        kind: "Giro",
        desc: routeLabel(r),
        driver: r.driver?.name ?? "",
        vehicle: r.vehicle?.name ?? "",
        km: r.km ?? null,
        cost: routeTotalCost(r) ?? null,
      })),
      ...tractions.map((t) => ({
        date: t.tractionDate,
        kind: "Trazione",
        desc: `${t.origin} → ${t.destination}`,
        driver: t.driver?.name ?? "",
        vehicle: t.plate ?? "",
        km: t.km ?? null,
        cost: t.cost ?? null,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let totKm = 0;
    let totCost = 0;
    for (const e of entries) {
      totKm += e.km ?? 0;
      totCost += e.cost ?? 0;
      wsCosts.addRow({
        date: itDate(e.date),
        branch: branchName,
        kind: e.kind,
        desc: e.desc,
        driver: e.driver,
        vehicle: e.vehicle,
        km: e.km ?? "",
        cost: e.cost ?? "",
      });
    }
    const totalRow = wsCosts.addRow({
      desc: "TOTALE",
      km: Math.round(totKm * 10) / 10,
      cost: Math.round(totCost * 100) / 100,
    });
    totalRow.font = { bold: true };
    styleHeader(wsCosts);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
