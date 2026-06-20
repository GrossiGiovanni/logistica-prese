import { PageHeader } from "@/components/ui/PageHeader";
import { PickupForm } from "@/features/pickups/PickupForm";
import { listCustomersWithAddresses } from "@/features/customers/queries";
import { tomorrowInputValue } from "@/lib/dates";

export default async function NuovaPresaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const customers = await listCustomersWithAddresses();

  return (
    <div>
      <PageHeader title="Nuova presa" description="Inserisci una presa spot" />
      <PickupForm customers={customers} defaultDate={date ?? tomorrowInputValue()} />
    </div>
  );
}
