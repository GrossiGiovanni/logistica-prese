import { PageHeader } from "@/components/ui/PageHeader";
import { AddressForm } from "@/features/addresses/AddressForm";
import { listCustomers } from "@/features/customers/queries";

export default async function NuovoIndirizzoPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const customers = await listCustomers();

  return (
    <div>
      <PageHeader title="Nuovo indirizzo" description="Aggiungi un indirizzo di ritiro" />
      <AddressForm
        customers={customers}
        defaultCustomerId={customerId}
      />
    </div>
  );
}
