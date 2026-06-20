import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { AddressForm } from "@/features/addresses/AddressForm";
import { getAddress } from "@/features/addresses/queries";
import { listCustomers } from "@/features/customers/queries";

export default async function ModificaIndirizzoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [address, customers] = await Promise.all([getAddress(id), listCustomers()]);
  if (!address) notFound();

  return (
    <div>
      <PageHeader title="Modifica indirizzo" description={`${address.street}, ${address.city}`} />
      <AddressForm address={address} customers={customers} />
    </div>
  );
}
