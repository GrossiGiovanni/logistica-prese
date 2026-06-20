import { PageHeader } from "@/components/ui/PageHeader";
import { RecurringPickupForm } from "@/features/recurring-pickups/RecurringPickupForm";
import { listCustomersWithAddresses } from "@/features/customers/queries";

export default async function NuovaPresaFissaPage() {
  const customers = await listCustomersWithAddresses();
  return (
    <div>
      <PageHeader title="Nuova presa fissa" description="Crea una ricorrenza" />
      <RecurringPickupForm customers={customers} />
    </div>
  );
}
