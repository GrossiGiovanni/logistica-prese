import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecurringPickupForm } from "@/features/recurring-pickups/RecurringPickupForm";
import { getRecurringPickup } from "@/features/recurring-pickups/queries";
import { listCustomersWithAddresses } from "@/features/customers/queries";
import { requireBranchId } from "@/lib/branch";

export default async function ModificaPresaFissaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const branchId = await requireBranchId();
  const [recurring, customers] = await Promise.all([
    getRecurringPickup(branchId, id),
    listCustomersWithAddresses(branchId),
  ]);
  if (!recurring) notFound();

  return (
    <div>
      <PageHeader title="Modifica presa fissa" description="Ricorrenza" />
      <RecurringPickupForm recurring={recurring} customers={customers} />
    </div>
  );
}
