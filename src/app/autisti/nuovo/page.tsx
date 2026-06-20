import { PageHeader } from "@/components/ui/PageHeader";
import { DriverForm } from "@/features/drivers/DriverForm";
import { listActiveVehicles } from "@/features/vehicles/queries";

export default async function NuovoAutistaPage() {
  const vehicles = await listActiveVehicles();
  return (
    <div>
      <PageHeader title="Nuovo autista" description="Aggiungi un autista" />
      <DriverForm vehicles={vehicles} />
    </div>
  );
}
