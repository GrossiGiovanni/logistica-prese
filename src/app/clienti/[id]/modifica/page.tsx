import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerForm } from "@/features/customers/CustomerForm";
import { getCustomer } from "@/features/customers/queries";

export default async function ModificaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <div>
      <PageHeader title="Modifica cliente" description={customer.name} />
      <CustomerForm customer={customer} />
    </div>
  );
}
