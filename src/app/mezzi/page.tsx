import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Badge } from "@/components/badges/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { listVehicles } from "@/features/vehicles/queries";
import { deleteVehicle } from "@/features/vehicles/actions";
import { vehicleTypeLabels, costLevelLabels } from "@/lib/labels";

type Row = Awaited<ReturnType<typeof listVehicles>>[number];

export default async function MezziPage() {
  const vehicles = await listVehicles();

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
    {
      header: "Tipo",
      cell: (v) => (
        <Badge tone={v.vehicleType === "MOTRICE" ? "purple" : "slate"}>
          {vehicleTypeLabels[v.vehicleType]}
        </Badge>
      ),
    },
    { header: "Capacità", cell: (v) => (v.capacityPallets != null ? `${v.capacityPallets} pallet` : "—") },
    { header: "Sponda", cell: (v) => (v.hasTailLift ? "Sì" : "No") },
    {
      header: "Costo",
      cell: (v) => (
        <Badge tone={v.costLevel === "HIGH" ? "red" : v.costLevel === "MEDIUM" ? "amber" : "green"}>
          {costLevelLabels[v.costLevel]}
        </Badge>
      ),
    },
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
      <DataTable
        columns={columns}
        rows={vehicles}
        empty={{ title: "Nessun mezzo", action: { href: "/mezzi/nuovo", label: "Nuovo mezzo" } }}
      />
    </div>
  );
}
