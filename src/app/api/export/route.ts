// Export Excel (.xlsx), sempre limitato alla filiale corrente.
// /api/export?type=prese&from=YYYY-MM-DD&to=YYYY-MM-DD
// /api/export?type=giri&from=YYYY-MM-DD&to=YYYY-MM-DD
// /api/export?type=giornata&date=YYYY-MM-DD   — lista scarichi per il magazzino:
//                                               solo Autista + Cliente
// /api/export?type=carichi&from=&to=&carrier= — carichi: solo Vettore + Note
//
// L'export "giri" produce un file multi-foglio:
//   1) Riepilogo giri     — una riga per giro
//   2) Dettaglio prese eseguite — una riga per presa (ritiro) assegnata a un giro
//   3) Dettaglio resi     — una riga per reso assegnato a un giro (separato dalle
//                            prese: i quantitativi dei resi NON si sommano ai ritiri)
//   4) Costi e km         — una riga per giro (ritiri) e per carico (nolo:
//                            trazione industriale Eurosarda o nolo esterno)
//   5) Riepilogo costi    — stessa ripartizione di Home e report (Rama, Omar,
//                            Costo Industriale = ritiri + trazioni Eurosarda,
//                            noli esterni; solo giri CONFERMATI, bozze escluse)
// Le date sono vere celle data Excel (ordinabili/filtrabili), non testo.
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
import { routeTotalCost, costLines, isIndustrialCarico, computeCostBreakdown, driverCompanyLabels } from "@/lib/costs";
import { routeLabel, routeShiftLabels, routeStatusLabels } from "@/lib/labels";
import { pickupOperationalStatusLabels, pickupStatusOf } from "@/lib/pickup-status";
import { parseDateOnly, isValidDateInput, todayInputValue, addDaysInput } from "@/lib/dates";
import { excelDate, formatDateColumns } from "@/lib/excel";

export const dynamic = "force-dynamic";

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
      where: { branchId, pickupDate: range, cancelledAt: null },
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
        date: excelDate(p.pickupDate),
        branch: branchName,
        cust: p.customer.name,
        city: p.address.city,
        prov: p.address.province,
        status: pickupOperationalStatusLabels[pickupStatusOf(p)],
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

    formatDateColumns(ws, ["date"]);
    styleHeader(ws);
  } else if (type === "giornata") {
    // ---- Lista scarichi per il magazzino: SOLO autista + cliente ----
    // Tabella volutamente essenziale: niente indirizzi, quantita', km o note,
    // che in magazzino rendono il file poco leggibile.
    const day = isValidDateInput(sp.get("date") ?? "") ? sp.get("date")! : todayInputValue();
    const routes = await prisma.route.findMany({
      where: { branchId, routeDate: parseDateOnly(day) },
      include: routeInclude,
      orderBy: [{ shift: "asc" }, { createdAt: "asc" }],
    });

    // Una riga per presa: l'autista si ripete su ognuna delle sue prese.
    const rows: { driver: string; customer: string }[] = [];
    for (const r of routes) {
      const driver = r.driver?.name ?? "Autista da assegnare";
      for (const s of r.stops) {
        if (!s.pickup) continue;
        rows.push({ driver, customer: s.pickup.customer.name });
      }
    }
    // Righe dello stesso autista vicine; il sort stabile mantiene l'ordine
    // delle fermate all'interno del singolo autista.
    rows.sort((a, b) => a.driver.localeCompare(b.driver, "it"));

    const ws = wb.addWorksheet("Lista scarichi");
    ws.columns = [
      { header: "Autista", key: "driver", width: 28 },
      { header: "Cliente", key: "customer", width: 46 },
    ];
    for (const row of rows) ws.addRow(row);
    styleHeader(ws);

    fileName = `lista_scarichi_${day}.xlsx`;
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

    // Tabella essenziale a due colonne: solo vettore e note di carico.
    const ws = wb.addWorksheet("Carichi");
    ws.columns = [
      { header: "Vettore", key: "carrier", width: 32 },
      { header: "Note di carico", key: "notes", width: 60 },
    ];
    for (const c of carichi) {
      ws.addRow({ carrier: c.carrier, notes: c.notes ?? "" });
    }
    styleHeader(ws);
  } else {
    // Le trazioni sono SOLO i Carichi: nessuna altra fonte, nessun doppio conteggio.
    const [routes, carichi] = await Promise.all([
      prisma.route.findMany({
        where: { branchId, routeDate: range },
        include: routeInclude,
        orderBy: [{ routeDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.carico.findMany({
        where: { branchId, loadDate: range },
        include: {
          driver: { select: { name: true, company: true } },
          trazionista: { select: { isEurosarda: true } },
        },
        orderBy: [{ loadDate: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    const companyOf = (r: (typeof routes)[number]) =>
      r.driver ? driverCompanyLabels[r.driver.company] : "Senza autista";

    // ---- Foglio 1: Riepilogo giri (una riga per giro) --------------------
    const wsSummary = wb.addWorksheet("Riepilogo giri");
    wsSummary.columns = [
      { header: "Data", key: "date", width: 12 },
      { header: "Filiale", key: "branch", width: 12 },
      { header: "Giro", key: "label", width: 26 },
      { header: "Autista", key: "driver", width: 16 },
      { header: "Mezzo", key: "vehicle", width: 18 },
      { header: "Azienda", key: "company", width: 18 },
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
        date: excelDate(r.routeDate),
        branch: branchName,
        label: routeLabel(r),
        driver: r.driver?.name ?? "",
        vehicle: r.vehicle?.name ?? "",
        company: companyOf(r),
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
    formatDateColumns(wsSummary, ["date"]);
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
          date: excelDate(r.routeDate),
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
          // In un giro: stato calcolato = Pianificata (o Annullata).
          status: pickupOperationalStatusLabels[pickupStatusOf({ ...p, routeStops: [s] })],
        });
      }
    }
    formatDateColumns(wsPickups, ["date"]);
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
          date: excelDate(r.routeDate),
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
    formatDateColumns(wsResi, ["date"]);
    styleHeader(wsResi);

    // ---- Foglio 4: Costi e km (giri + noli dei carichi) -----------------
    const wsCosts = wb.addWorksheet("Costi e km");
    wsCosts.columns = [
      { header: "Data", key: "date", width: 12 },
      { header: "Filiale", key: "branch", width: 12 },
      { header: "Tipo", key: "kind", width: 22 },
      { header: "Descrizione", key: "desc", width: 34 },
      { header: "Autista", key: "driver", width: 16 },
      { header: "Azienda / Vettore", key: "company", width: 20 },
      { header: "Mezzo", key: "vehicle", width: 18 },
      { header: "Km", key: "km", width: 8 },
      { header: "Costo (€)", key: "cost", width: 10 },
    ];
    // Righe unificate, ordinate per data: facile sommare per giornata, tipo o
    // azienda con un filtro/pivot in Excel. I giri in bozza sono elencati ma
    // esclusi dal totale (come in Home e nei report).
    type CostEntry = {
      date: Date;
      kind: string;
      desc: string;
      driver: string;
      company: string;
      vehicle: string;
      km: number | null;
      cost: number | null;
      counted: boolean;
    };
    const entries: CostEntry[] = [
      ...routes.map((r) => ({
        date: r.routeDate,
        kind: r.status === "CONFIRMED" ? "Giro (ritiri)" : "Giro in bozza (escluso)",
        desc: routeLabel(r),
        driver: r.driver?.name ?? "",
        company: companyOf(r),
        vehicle: r.vehicle?.name ?? "",
        km: r.km ?? null,
        cost: routeTotalCost(r) ?? null,
        counted: r.status === "CONFIRMED",
      })),
      ...carichi.map((c) => ({
        date: c.loadDate,
        kind: isIndustrialCarico(c) ? "Trazione industriale" : "Nolo esterno",
        desc: [c.destination, c.notes].filter(Boolean).join(" · ") || "Carico",
        driver: c.driver?.name ?? "",
        company: c.carrier,
        vehicle: c.plate ?? "",
        km: null,
        cost: c.nolo ?? null,
        counted: true,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let totKm = 0;
    let totCost = 0;
    for (const e of entries) {
      if (e.counted) {
        totKm += e.km ?? 0;
        totCost += e.cost ?? 0;
      }
      const { counted: _counted, ...row } = e;
      wsCosts.addRow({ ...row, date: excelDate(e.date), branch: branchName, km: e.km ?? "", cost: e.cost ?? "" });
    }
    const totalRow = wsCosts.addRow({
      desc: "TOTALE (giri confermati + carichi)",
      km: Math.round(totKm * 10) / 10,
      cost: Math.round(totCost * 100) / 100,
    });
    totalRow.font = { bold: true };
    formatDateColumns(wsCosts, ["date"]);
    styleHeader(wsCosts);

    // ---- Foglio 5: Riepilogo costi (stessa ripartizione di Home e report) --
    const costs = computeCostBreakdown({ routes, carichi });
    const wsRecap = wb.addWorksheet("Riepilogo costi");
    wsRecap.columns = [
      { header: "Voce", key: "label", width: 30 },
      { header: "Costo (€)", key: "value", width: 14 },
      { header: "Dettaglio", key: "hint", width: 50 },
    ];
    const round2 = (v: number) => Math.round(v * 100) / 100;
    for (const l of costLines(costs)) wsRecap.addRow({ label: l.label, value: round2(l.value), hint: l.hint });
    const recapTotal = wsRecap.addRow({
      label: "COSTO TOTALE",
      value: round2(costs.total),
      hint: "Somma delle voci sopra (giri confermati + noli dei carichi)",
    });
    recapTotal.font = { bold: true };
    wsRecap.addRow({});
    wsRecap.addRow({ label: "Costo raccolta", value: round2(costs.raccolta), hint: "Rama + Omar + Industriale ritiri" });
    wsRecap.addRow({ label: "di cui Industriale ritiri", value: round2(costs.industrialeRitiri), hint: "Giri autisti Eurosarda" });
    wsRecap.addRow({ label: "Trazioni Eurosarda", value: round2(costs.trazioniIndustriali), hint: "Carichi Eurosarda, inclusi nel Costo Industriale" });
    styleHeader(wsRecap);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
