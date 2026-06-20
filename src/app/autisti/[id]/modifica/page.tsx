import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { DriverForm } from "@/features/drivers/DriverForm";
import { getDriver } from "@/features/drivers/queries";
import { listActiveVehicles } from "@/features/vehicles/queries";

export default async function ModificaAutistaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [driver, vehicles] = await Promise.all([getDriver(id), listActiveVehicles()]);
  if (!driver) notFound();

  return (
    <div>
      <PageHeader title="Modifica autista" description={driver.name} />
      <DriverForm driver={driver} vehicles={vehicles} />
    </div>
  );
}
