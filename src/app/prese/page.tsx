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
import { pickupSourceLabels, timeWindowLabels, priorityLabels } from "@/lib/labels";
import { formatDateIt } from "@/lib/dates";
import type { PickupStatus, PickupSourceType, TimeWindow } from "@prisma/client";

export default async function PresePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters = {
    date: sp.date || undefined,
    status: (sp.status as PickupStatus) || undefined,
    sourceType: (sp.sourceType as PickupSourceType) || undefined,
    timeWindow: (sp.timeWindow as TimeWindow) || undefined,
    search: sp.search || undefined,
  };
  const pickups = await listPickups(filters);

  const columns: Column<PickupWithRelations>[] = [
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
      cell: (p) =>
        [
          p.pallets != null ? `${p.pallets} plt` : null,
          p.loadingMeters != null ? `${p.loadingMeters} mtl` : null,
          p.volumeM3 != null ? `${p.volumeM3} m³` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "—",
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
      header: "",
      className: "text-right",
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <Link href={`/prese/${p.id}/modifica`} className="btn-secondary">Modifica</Link>
          {p.status !== "CANCELLED" ? (
            <form action={cancelPickup}>
              <input type="hidden" name="id" value={p.id} />
              <ConfirmButton variant="danger" confirm="Annullare questa presa?">Annulla</ConfirmButton>
            </form>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Prese"
        description="Tutte le prese/ritiri"
        action={{ href: "/prese/nuova", label: "Nuova presa" }}
      />
      <PickupFiltersBar current={sp} />
      <DataTable
        columns={columns}
        rows={pickups}
        empty={{
          title: "Nessuna presa",
          description: "Nessuna presa corrisponde ai filtri.",
          action: { href: "/prese/nuova", label: "Nuova presa" },
        }}
      />
    </div>
  );
}
