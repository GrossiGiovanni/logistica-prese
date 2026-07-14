import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResoForm } from "@/features/resi/ResoForm";
import { listCustomersWithAddresses } from "@/features/customers/queries";
import { prisma } from "@/lib/db";
import { toDateInputValue } from "@/lib/dates";

export default async function ModificaResoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [reso, customers] = await Promise.all([
    prisma.reso.findUnique({ where: { id } }),
    listCustomersWithAddresses(),
  ]);
  if (!reso) notFound();

  return (
    <div>
      <PageHeader title="Modifica reso" description={`Distinta ${reso.distintaNumber ?? "—"}`} />
      <ResoForm reso={reso} customers={customers} defaultDate={toDateInputValue(reso.resoDate)} />
    </div>
  );
}
