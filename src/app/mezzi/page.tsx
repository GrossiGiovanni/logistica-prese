import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Badge } from "@/components/badges/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { listVehicles } from "@/features/vehicles/queries";
import { deleteVehicle } from "@/features/vehicles/actions";
import { vehicleTypeLabels, routeShiftLabels } from "@/lib/labels";
import { formatEuro } from "@/lib/costs";

type Row = Awaited<ReturnType<typeof listVehicles>>[number];

export default async function MezziPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const vehicles = await listVehicles(q);

  const columns: Column<Row>[] = [
    {
      header: "Mezzo",
      cell: (v) => (
        <div className="flex items-center gap-2">
          <Link href={`/mezzi/${v.id}/modifica`} className="font-medium text-brand-700 hover:underline">
            {v.name}
          </Link>
          {v.vehicleType === "MOTRICE" ? <Badge tone="purple">Motrice</Badge> : null}
          {!v.active ? <Badge tone="slate">Inattivo</Badge> : null}
        </div>
      ),
    },
    { header: "Targa", cell: (v) => v.plate ?? "—" },
    { header: "Titolare", cell: (v) => v.owner ?? "—" },
    {
      header: "Tipo",
      cell: (v) => (
        <Badge tone={v.vehicleType === "MOTRICE" ? "purple" : "slate"}>
          {vehicleTypeLabels[v.vehicleType]}
        </Badge>
      ),
    },
    {
      header: "Capacità",
      cell: (v) =>
        [
          v.capacityPallets != null ? `${v.capacityPallets} plt` : null,
          v.capacityVolumeM3 != null ? `${v.capacityVolumeM3} m³` : null,
          v.capacityWeightKg != null ? `${v.capacityWeightKg} kg` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "—",
    },
    {
      header: "Disponibilità",
      cell: (v) => (
        <Badge tone={v.availability === "FULL_DAY" ? "slate" : "amber"}>
          {routeShiftLabels[v.availability]}
        </Badge>
      ),
    },
    { header: "Costo/gg", cell: (v) => formatEuro(v.dailyCost) },
    {
      header: "",
      className: "text-right",
      cell: (v) => (
        <div className="flex justify-end gap-2">
          <Link href={`/mezzi/${v.id}/modifica`} className="btn-secondary">Modifica</Link>
          {v.active ? (
            <form action={deleteVehicle}>
              <input type="hidden" name="id" value={v.id} />
              <ConfirmButton variant="danger" confirm={`Disattivare il mezzo "${v.name}"?`}>
                Disattiva
              </ConfirmButton>
            </form>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Mezzi"
        description="Parco mezzi. Le motrici (costo alto) sono evidenziate."
        action={{ href: "/mezzi/nuovo", label: "Nuovo mezzo" }}
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="grow">
          <label className="field-label">Cerca mezzo</label>
          <input type="text" name="q" defaultValue={q ?? ""} placeholder="Nome, targa, titolare, tipo (es. motrice)…" className="field-input" />
        </div>
        <button type="submit" className="btn-primary">Cerca</button>
        {q ? <a href="/mezzi" className="btn-secondary">Azzera</a> : null}
      </form>
      <DataTable
        columns={columns}
        rows={vehicles}
        empty={{
          title: q ? "Nessun mezzo trovato" : "Nessun mezzo",
          description: q ? `Nessun mezzo corrisponde a "${q}".` : undefined,
          action: { href: "/mezzi/nuovo", label: "Nuovo mezzo" },
        }}
      />
    </div>
  );
}
