import { PageHeader } from "@/components/ui/PageHeader";
import { VehicleForm } from "@/features/vehicles/VehicleForm";

export default function NuovoMezzoPage() {
  return (
    <div>
      <PageHeader title="Nuovo mezzo" description="Aggiungi un mezzo al parco" />
      <VehicleForm />
    </div>
  );
}
