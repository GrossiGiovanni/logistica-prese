import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { VehicleForm } from "@/features/vehicles/VehicleForm";
import { getVehicle } from "@/features/vehicles/queries";

export default async function ModificaMezzoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();

  return (
    <div>
      <PageHeader title="Modifica mezzo" description={vehicle.name} />
      <VehicleForm vehicle={vehicle} />
    </div>
  );
}
