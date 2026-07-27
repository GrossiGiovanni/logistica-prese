import { PageHeader } from "@/components/ui/PageHeader";
import { DriverForm } from "@/features/drivers/DriverForm";
import { listActiveVehicles } from "@/features/vehicles/queries";
import { requireBranchId } from "@/lib/branch";

export default async function NuovoAutistaPage() {
  const branchId = await requireBranchId();
  const vehicles = await listActiveVehicles(branchId);
  return (
    <div>
      <PageHeader title="Nuovo autista" description="Aggiungi un autista" />
      <DriverForm vehicles={vehicles} />
    </div>
  );
}
