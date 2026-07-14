import { PageHeader } from "@/components/ui/PageHeader";
import { ResoForm } from "@/features/resi/ResoForm";
import { listCustomersWithAddresses } from "@/features/customers/queries";
import { tomorrowInputValue } from "@/lib/dates";

export default async function NuovoResoPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const customers = await listCustomersWithAddresses();

  return (
    <div>
      <PageHeader title="Nuovo reso" description="Registra una consegna di resi al cliente (senza ritiro)" />
      <ResoForm customers={customers} defaultDate={date ?? tomorrowInputValue()} />
    </div>
  );
}
