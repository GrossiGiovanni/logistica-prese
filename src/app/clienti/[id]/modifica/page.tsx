import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerForm } from "@/features/customers/CustomerForm";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { getCustomerWithAddresses } from "@/features/customers/queries";
import { deleteAddress } from "@/features/addresses/actions";

export default async function ModificaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerWithAddresses(id);
  if (!customer) notFound();

  return (
    <div>
      <PageHeader title="Modifica cliente" description={customer.name} />
      <CustomerForm customer={customer} />

      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Indirizzi ({customer.addresses.length})
          </h2>
          <Link href={`/indirizzi/nuovo?customerId=${customer.id}`} className="btn-primary">
            + Aggiungi indirizzo
          </Link>
        </div>

        {customer.addresses.length === 0 ? (
          <div className="card px-4 py-6 text-center text-sm text-slate-500">
            Nessun indirizzo. Aggiungine uno per poter creare prese per questo cliente.
          </div>
        ) : (
          <ul className="space-y-2">
            {customer.addresses.map((a) => (
              <li key={a.id} className="card flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">
                    {a.label ? `${a.label} — ` : ""}
                    {a.street}
                  </div>
                  <div className="text-xs text-slate-500">
                    {a.city} ({a.province}){a.postalCode ? ` · ${a.postalCode}` : ""} · {a._count.pickups} prese
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={`/indirizzi/${a.id}/modifica`} className="btn-secondary">
                    Modifica
                  </Link>
                  {a._count.pickups === 0 ? (
                    <form action={deleteAddress}>
                      <input type="hidden" name="id" value={a.id} />
                      <ConfirmButton variant="danger" confirm="Eliminare questo indirizzo?">
                        Elimina
                      </ConfirmButton>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
