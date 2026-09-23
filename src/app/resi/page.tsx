// Report RESI: consultazione e ricerca dei resi senza dover ricordare il giorno
// esatto. Filtri per intervallo date, cliente, numero distinta e autista/giro.

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/badges/Badge";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/branch";
import { routeLabel } from "@/lib/labels";
import {
  formatDateIt,
  todayInputValue,
  addDaysInput,
  parseDateOnly,
  isValidDateInput,
} from "@/lib/dates";
import type { Prisma } from "@prisma/client";

export default async function ResiPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    customerId?: string;
    distinta?: string;
    driverId?: string;
  }>;
}) {
  const sp = await searchParams;
  const branchId = await requireBranchId();
  // Default: ultimi 90 giorni (un reso si cerca spesso a distanza di tempo).
  const from = sp.from && isValidDateInput(sp.from) ? sp.from : addDaysInput(todayInputValue(), -90);
  const to = sp.to && isValidDateInput(sp.to) ? sp.to : todayInputValue();
  const customerId = sp.customerId || "";
  const distinta = (sp.distinta ?? "").trim();
  const driverId = sp.driverId || "";

  const where: Prisma.ResoWhereInput = {
    branchId,
    resoDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
  };
  if (customerId) where.customerId = customerId;
  if (distinta) where.distintaNumber = { contains: distinta, mode: "insensitive" };
  if (driverId) where.routeStops = { some: { route: { driverId } } };

  const [resi, customers, drivers] = await Promise.all([
    prisma.reso.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        address: { select: { city: true, province: true } },
        routeStops: {
          select: {
            route: {
              select: {
                id: true,
                routeDate: true,
                driver: { select: { name: true } },
                vehicle: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ resoDate: "desc" }, { createdAt: "asc" }],
      take: 500,
    }),
    prisma.customer.findMany({
      where: { branchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.driver.findMany({
      where: { branchId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totResi = resi.reduce((s, r) => s + (r.resiCount ?? 0), 0);
  const totPallet = resi.reduce((s, r) => s + (r.pallets ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Resi"
        description="Consultazione e ricerca dei resi per periodo, cliente, distinta e autista"
      >
        <Link href="/resi/nuovo" className="btn-primary">Nuovo reso</Link>
      </PageHeader>

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div>
          <label className="field-label">Da</label>
          <input type="date" name="from" defaultValue={from} className="field-input w-auto" />
        </div>
        <div>
          <label className="field-label">A</label>
          <input type="date" name="to" defaultValue={to} className="field-input w-auto" />
        </div>
        <div>
          <label className="field-label">Cliente</label>
          <select name="customerId" defaultValue={customerId} className="field-input w-56">
            <option value="">Tutti</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">N. distinta</label>
          <input name="distinta" defaultValue={distinta} placeholder="Anche parziale" className="field-input w-36" />
        </div>
        <div>
          <label className="field-label">Autista / giro</label>
          <select name="driverId" defaultValue={driverId} className="field-input w-auto">
            <option value="">Tutti</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Cerca</button>
          <a href="/resi" className="btn-secondary">Azzera</a>
        </div>
      </form>

      <h2 className="mb-2 text-base font-semibold text-slate-900">
        Resi dal {formatDateIt(parseDateOnly(from))} al {formatDateIt(parseDateOnly(to))} ({resi.length})
        {totResi > 0 ? ` · ${totResi} resi consegnati` : ""}
        {totPallet > 0 ? ` · ${totPallet} pallet` : ""}
      </h2>

      {resi.length === 0 ? (
        <div className="card px-4 py-6 text-center text-sm text-slate-500">
          Nessun reso trovato con questi filtri.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">N. distinta</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Località</th>
                <th className="px-3 py-2">Resi</th>
                <th className="px-3 py-2">Pallet</th>
                <th className="px-3 py-2">Colli</th>
                <th className="px-3 py-2">Giro / Autista</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {resi.map((r) => {
                const route = r.routeStops[0]?.route;
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-2">{formatDateIt(r.resoDate)}</td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-brand-700">
                      {r.distintaNumber ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{r.customer.name}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {r.address ? `${r.address.city} (${r.address.province})` : "—"}
                    </td>
                    <td className="px-3 py-2">{r.resiCount ?? "—"}</td>
                    <td className="px-3 py-2">{r.pallets ?? "—"}</td>
                    <td className="px-3 py-2">{r.colli ?? "—"}</td>
                    <td className="px-3 py-2">
                      {route ? (
                        <Link href={`/giri/${route.id}`} className="text-brand-700 hover:underline">
                          {routeLabel(route)}
                        </Link>
                      ) : (
                        <Badge tone="slate">Non assegnato</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.notes ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/resi/${r.id}/modifica`} className="btn-secondary px-2 py-1">Apri</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
