import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Badge } from "@/components/badges/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { listDrivers } from "@/features/drivers/queries";
import { deleteDriver } from "@/features/drivers/actions";

type Row = Awaited<ReturnType<typeof listDrivers>>[number];

export default async function AutistiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const drivers = await listDrivers(q);

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
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="grow">
          <label className="field-label">Cerca autista</label>
          <input type="text" name="q" defaultValue={q ?? ""} placeholder="Nome, codice, telefono, mezzo/targa…" className="field-input" />
        </div>
        <button type="submit" className="btn-primary">Cerca</button>
        {q ? <a href="/autisti" className="btn-secondary">Azzera</a> : null}
      </form>
      <DataTable
        columns={columns}
        rows={drivers}
        empty={{
          title: q ? "Nessun autista trovato" : "Nessun autista",
          description: q ? `Nessun autista corrisponde a "${q}".` : undefined,
          action: { href: "/autisti/nuovo", label: "Nuovo autista" },
        }}
      />
    </div>
  );
}
