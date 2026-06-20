import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerForm } from "@/features/customers/CustomerForm";

export default function NuovoClientePage() {
  return (
    <div>
      <PageHeader title="Nuovo cliente" description="Crea un nuovo cliente" />
      <CustomerForm />
    </div>
  );
}
