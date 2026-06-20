import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { listAddresses } from "@/features/addresses/queries";
import { deleteAddress } from "@/features/addresses/actions";

type Row = Awaited<ReturnType<typeof listAddresses>>[number];

export default async function IndirizziPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const addresses = await listAddresses();

  const columns: Column<Row>[] = [
    { header: "Cliente", cell: (a) => a.customer.name },
    { header: "Etichetta", cell: (a) => a.label ?? "—" },
    { header: "Indirizzo", cell: (a) => `${a.street}` },
    { header: "Località", cell: (a) => `${a.city} (${a.province})` },
    { header: "CAP", cell: (a) => a.postalCode ?? "—" },
    { header: "Prese", cell: (a) => a._count.pickups },
    {
      header: "",
      className: "text-right",
      cell: (a) => (
        <div className="flex justify-end gap-2">
          <Link href={`/indirizzi/${a.id}/modifica`} className="btn-secondary">
            Modifica
          </Link>
          <form action={deleteAddress}>
            <input type="hidden" name="id" value={a.id} />
            <ConfirmButton variant="danger" confirm="Eliminare questo indirizzo?">
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
        title="Indirizzi"
        description="Indirizzi di ritiro dei clienti"
        action={{ href: "/indirizzi/nuovo", label: "Nuovo indirizzo" }}
      />
      {error === "has-pickups" ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Impossibile eliminare: l&apos;indirizzo ha prese collegate.
        </p>
      ) : null}
      <DataTable
        columns={columns}
        rows={addresses}
        empty={{
          title: "Nessun indirizzo",
          description: "Aggiungi un indirizzo di ritiro a un cliente.",
          action: { href: "/indirizzi/nuovo", label: "Nuovo indirizzo" },
        }}
      />
    </div>
  );
}
