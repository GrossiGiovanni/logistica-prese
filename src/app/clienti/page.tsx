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
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  const { error, q } = await searchParams;
  const customers = await listCustomers(q);

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
          <Link href={`/indirizzi/nuovo?customerId=${c.id}`} className="btn-secondary">
            + Indirizzo
          </Link>
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

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="grow">
          <label className="field-label">Cerca cliente</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nome, città, indirizzo, telefono, email…"
            className="field-input"
          />
        </div>
        <button type="submit" className="btn-primary">Cerca</button>
        {q ? <a href="/clienti" className="btn-secondary">Azzera</a> : null}
      </form>

      <DataTable
        columns={columns}
        rows={customers}
        empty={{
          title: q ? "Nessun cliente trovato" : "Nessun cliente",
          description: q
            ? `Nessun cliente corrisponde a "${q}".`
            : "Crea il primo cliente per iniziare.",
          action: { href: "/clienti/nuovo", label: "Nuovo cliente" },
        }}
      />
    </div>
  );
}
