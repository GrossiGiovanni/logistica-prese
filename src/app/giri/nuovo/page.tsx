import { PageHeader } from "@/components/ui/PageHeader";
import { RouteForm } from "@/features/routes/RouteForm";
import { listActiveDrivers } from "@/features/drivers/queries";
import { listActiveVehicles } from "@/features/vehicles/queries";
import { tomorrowInputValue } from "@/lib/dates";

export default async function NuovoGiroPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const [drivers, vehicles] = await Promise.all([
    listActiveDrivers(),
    listActiveVehicles(),
  ]);

  return (
    <div>
      <PageHeader title="Nuovo giro" description="Crea un giro per una data" />
      <RouteForm
        drivers={drivers}
        vehicles={vehicles}
        defaultDate={date ?? tomorrowInputValue()}
      />
    </div>
  );
}
