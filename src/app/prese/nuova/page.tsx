import { PageHeader } from "@/components/ui/PageHeader";
import { PickupForm } from "@/features/pickups/PickupForm";
import { listCustomersWithAddresses } from "@/features/customers/queries";
import { tomorrowInputValue } from "@/lib/dates";
import { requireBranchId } from "@/lib/branch";

export default async function NuovaPresaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const branchId = await requireBranchId();
  const customers = await listCustomersWithAddresses(branchId);

  return (
    <div>
      <PageHeader title="Nuova presa" description="Inserisci una presa spot" />
      <PickupForm customers={customers} defaultDate={date ?? tomorrowInputValue()} />
    </div>
  );
}
