import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { VehicleForm } from "@/features/vehicles/VehicleForm";
import { getVehicle } from "@/features/vehicles/queries";
import { requireBranchId } from "@/lib/branch";

export default async function ModificaMezzoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const branchId = await requireBranchId();
  const vehicle = await getVehicle(branchId, id);
  if (!vehicle) notFound();

  return (
    <div>
      <PageHeader title="Modifica mezzo" description={vehicle.name} />
      <VehicleForm vehicle={vehicle} />
    </div>
  );
}
