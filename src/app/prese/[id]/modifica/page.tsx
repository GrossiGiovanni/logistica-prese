import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PickupForm } from "@/features/pickups/PickupForm";
import { getPickup } from "@/features/pickups/queries";
import { listCustomersWithAddresses } from "@/features/customers/queries";
import { tomorrowInputValue } from "@/lib/dates";

export default async function ModificaPresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pickup, customers] = await Promise.all([
    getPickup(id),
    listCustomersWithAddresses(),
  ]);
  if (!pickup) notFound();

  return (
    <div>
      <PageHeader title="Modifica presa" description={pickup.customerId} />
      <PickupForm pickup={pickup} customers={customers} defaultDate={tomorrowInputValue()} />
    </div>
  );
}
