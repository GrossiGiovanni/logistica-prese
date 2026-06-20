import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { listCustomers } from "@/features/customers/queries";
import { deleteCustomer } from "@/features/customers/actions";

type Row = Awaited<ReturnType<typeof listCustomers>>[number];

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const customers = await listCustomers();

  const columns: Column<Row>[] = [
    {
      header: "Cliente",
      cell: (c) => (
        <Link href={`/clienti/${c.id}/modifica`} className="font-medium text-brand-700 hover:underline">
          {c.name}
        </Link>
      ),
    },
    { header: "P. IVA", cell: (c) => c.vatNumber ?? "—" },
    { header: "Telefono", cell: (c) => c.phone ?? "—" },
    { header: "Indirizzi", cell: (c) => c._count.addresses },
    { header: "Prese", cell: (c) => c._count.pickups },
    {
      header: "",
      className: "text-right",
      cell: (c) => (
        <div className="flex justify-end gap-2">
          <Link href={`/clienti/${c.id}/modifica`} className="btn-secondary">
            Modifica
          </Link>
          <form action={deleteCustomer}>
            <input type="hidden" name="id" value={c.id} />
            <ConfirmButton
              variant="danger"
              confirm={`Eliminare il cliente "${c.name}"?`}
            >
              Elimina
            </ConfirmButton>
          </form>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clienti"
        description="Anagrafica clienti"
        action={{ href: "/clienti/nuovo", label: "Nuovo cliente" }}
      />
      {error === "has-pickups" ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Impossibile eliminare: il cliente ha prese collegate.
        </p>
      ) : null}
      <DataTable
        columns={columns}
        rows={customers}
        empty={{
          title: "Nessun cliente",
          description: "Crea il primo cliente per iniziare.",
          action: { href: "/clienti/nuovo", label: "Nuovo cliente" },
        }}
      />
    </div>
  );
}
