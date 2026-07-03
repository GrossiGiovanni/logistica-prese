import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Badge } from "@/components/badges/Badge";
import { PickupStatusBadge } from "@/components/badges/StatusBadge";
import { MissingDataBadge } from "@/components/badges/WarningBadge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { listPickups, type PickupWithRelations } from "@/features/pickups/queries";
import { cancelPickup } from "@/features/pickups/actions";
import { PickupFiltersBar } from "@/features/pickups/PickupFilters";
import { hasMissingData } from "@/lib/warnings";
import { pickupSourceLabels, timeWindowLabels, priorityLabels, routeStatusLabels, routeLabel } from "@/lib/labels";
import { formatDateIt, todayInputValue, addDaysInput, parseDateOnly } from "@/lib/dates";
import { getPreseFilters, getOpDate } from "@/lib/persisted-filters";
import { RouteStatusBadge } from "@/components/badges/StatusBadge";
import type { PickupStatus, PickupSourceType, TimeWindow } from "@prisma/client";

export default async function PresePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [saved, opDate] = await Promise.all([getPreseFilters(), getOpDate()]);

  // Vista per giornata: una data è sempre selezionata. Quando c'è una ricerca,
  // si cerca su TUTTE le date (così trovi una presa qualsiasi e il suo giro).
  const searching = Boolean(saved.search);
  const viewDate = sp.date || opDate || todayInputValue();

  const filters = {
    date: searching ? undefined : viewDate,
    status: (saved.status as PickupStatus) || undefined,
    sourceType: (saved.sourceType as PickupSourceType) || undefined,
    timeWindow: (saved.timeWindow as TimeWindow) || undefined,
    search: saved.search || undefined,
    unassignedOnly: saved.unassigned === "1",
  };
  const pickups = await listPickups(filters);

  // Stato per la barra filtri: mostra sempre la data corrente.
  const barCurrent = { ...filters, date: viewDate, unassigned: filters.unassignedOnly };
  const prevDate = addDaysInput(viewDate, -1);
  const nextDate = addDaysInput(viewDate, 1);

  const columns: Column<PickupWithRelations>[] = [
    {
      header: "N. presa",
      cell: (p) =>
        p.pickupNumber ? (
          <span className="whitespace-nowrap font-mono text-xs font-semibold text-slate-800">
            {p.pickupNumber}
          </span>
        ) : (
          "—"
        ),
    },
    { header: "Data", cell: (p) => <span className="whitespace-nowrap">{formatDateIt(p.pickupDate)}</span> },
    {
      header: "Cliente / Località",
      cell: (p) => (
        <div>
          <div className="font-medium text-slate-800">{p.customer.name}</div>
          <div className="text-xs text-slate-500">
            {p.address.city} ({p.address.province})
            {p.destination ? <span className="text-slate-400"> · → {p.destination}</span> : null}
          </div>
        </div>
      ),
    },
    { header: "Origine", cell: (p) => <Badge tone={p.sourceType === "RECURRING" ? "blue" : "slate"}>{pickupSourceLabels[p.sourceType]}</Badge> },
    { header: "Fascia", cell: (p) => timeWindowLabels[p.timeWindow] },
    {
      header: "Quantità",
      cell: (p) => {
        const parts: string[] = [];
        if (p.pallets != null) {
          parts.push(`${p.pallets} plt (≈ ${(p.pallets * 0.4).toFixed(1)} m)`);
        } else if (p.loadingMeters != null) {
          parts.push(`${p.loadingMeters} mtl (≈ ${Math.round(p.loadingMeters * 2.5)} plt)`);
        }
        if (p.volumeM3 != null) parts.push(`${p.volumeM3} m³`);
        return parts.join(" · ") || "—";
      },
    },
    { header: "Priorità", cell: (p) => priorityLabels[p.priority] },
    {
      header: "Stato",
      cell: (p) => (
        <div className="flex flex-col items-start gap-1">
          <PickupStatusBadge status={p.status} />
          {hasMissingData(p) ? <MissingDataBadge /> : null}
        </div>
      ),
    },
    {
      header: "Giro / Viaggio",
      cell: (p) => {
        const rs = p.routeStops[0];
        if (!rs?.route) return <Badge tone="slate">Non assegnata</Badge>;
        const r = rs.route;
        return (
          <div className="text-xs">
            <div className="font-medium text-slate-700">{routeLabel(r)}</div>
            <div className="text-slate-500">
              {formatDateIt(r.routeDate)} · {routeStatusLabels[r.status]}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <RouteStatusBadge status={r.status} />
              <Link href={`/giri/${r.id}`} className="text-brand-700 hover:underline">
                Apri giro →
              </Link>
            </div>
          </div>
        );
      },
    },
    {
      header: "",
      className: "text-right",
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <Link href={`/prese/${p.id}/modifica`} className="btn-secondary">Modifica</Link>
          <form action={cancelPickup}>
            <input type="hidden" name="id" value={p.id} />
            <ConfirmButton
              variant="danger"
              confirm="Eliminare definitivamente questa presa? Se servirà di nuovo andrà ricreata o reimportata."
            >
              Annulla
            </ConfirmButton>
          </form>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Prese"
        description={
          searching
            ? "Risultati ricerca (tutte le date)"
            : `Prese del ${formatDateIt(parseDateOnly(viewDate))}`
        }
        action={{ href: "/prese/nuova", label: "Nuova presa" }}
      />

      {!searching ? (
        <div className="mb-3 flex items-center gap-2">
          <Link href={`/prese?date=${prevDate}`} className="btn-secondary">← Giorno prec.</Link>
          <Link href={`/prese?date=${todayInputValue()}`} className="btn-secondary">Oggi</Link>
          <Link href={`/prese?date=${nextDate}`} className="btn-secondary">Giorno succ. →</Link>
        </div>
      ) : (
        <div className="mb-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Ricerca attiva su tutte le date. Cancella la ricerca per tornare alla vista per giornata.
        </div>
      )}

      <PickupFiltersBar current={barCurrent} />
      <DataTable
        columns={columns}
        rows={pickups}
        empty={{
          title: "Nessuna presa",
          description: searching
            ? "Nessuna presa corrisponde alla ricerca."
            : "Nessuna presa per questa giornata.",
          action: { href: "/prese/nuova", label: "Nuova presa" },
        }}
      />
    </div>
  );
}
