import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Badge } from "@/components/badges/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { listDrivers } from "@/features/drivers/queries";
import { deleteDriver } from "@/features/drivers/actions";

type Row = Awaited<ReturnType<typeof listDrivers>>[number];

export default async function AutistiPage() {
  const drivers = await listDrivers();

  const columns: Column<Row>[] = [
    {
      header: "Autista",
      cell: (d) => (
        <div className="flex items-center gap-2">
          <Link href={`/autisti/${d.id}/modifica`} className="font-medium text-brand-700 hover:underline">
            {d.name}
          </Link>
          {!d.active ? <Badge tone="slate">Inattivo</Badge> : null}
        </div>
      ),
    },
    { header: "Codice", cell: (d) => d.code ?? "—" },
    { header: "Telefono", cell: (d) => d.phone ?? "—" },
    { header: "Mezzo predefinito", cell: (d) => d.defaultVehicle?.name ?? "—" },
    {
      header: "",
      className: "text-right",
      cell: (d) => (
        <div className="flex justify-end gap-2">
          <Link href={`/autisti/${d.id}/modifica`} className="btn-secondary">Modifica</Link>
          {d.active ? (
            <form action={deleteDriver}>
              <input type="hidden" name="id" value={d.id} />
              <ConfirmButton variant="danger" confirm={`Disattivare l'autista "${d.name}"?`}>
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
        title="Autisti"
        description="Anagrafica autisti"
        action={{ href: "/autisti/nuovo", label: "Nuovo autista" }}
      />
      <DataTable
        columns={columns}
        rows={drivers}
        empty={{ title: "Nessun autista", action: { href: "/autisti/nuovo", label: "Nuovo autista" } }}
      />
    </div>
  );
}
