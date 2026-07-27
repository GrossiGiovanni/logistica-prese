import { PageHeader } from "@/components/ui/PageHeader";
import { RecurringPickupForm } from "@/features/recurring-pickups/RecurringPickupForm";
import { listCustomersWithAddresses } from "@/features/customers/queries";
import { requireBranchId } from "@/lib/branch";

export default async function NuovaPresaFissaPage() {
  const branchId = await requireBranchId();
  const customers = await listCustomersWithAddresses(branchId);
  return (
    <div>
      <PageHeader title="Nuova presa fissa" description="Crea una ricorrenza" />
      <RecurringPickupForm customers={customers} />
    </div>
  );
}
