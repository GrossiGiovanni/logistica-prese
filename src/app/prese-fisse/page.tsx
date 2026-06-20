import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Badge } from "@/components/badges/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  listRecurringPickups,
  type RecurringWithRelations,
} from "@/features/recurring-pickups/queries";
import { deleteRecurringPickup } from "@/features/recurring-pickups/actions";
import { GenerateRecurringForm } from "@/features/recurring-pickups/GenerateRecurringForm";
import { timeWindowLabels } from "@/lib/labels";
import { tomorrowInputValue } from "@/lib/dates";

const dayDefs: { key: keyof RecurringWithRelations; label: string }[] = [
  { key: "monday", label: "Lun" },
  { key: "tuesday", label: "Mar" },
  { key: "wednesday", label: "Mer" },
  { key: "thursday", label: "Gio" },
  { key: "friday", label: "Ven" },
  { key: "saturday", label: "Sab" },
  { key: "sunday", label: "Dom" },
];

export default async function PreseFissePage({
  searchParams,
}: {
  searchParams: Promise<{ gen?: string; genError?: string }>;
}) {
  const { gen, genError } = await searchParams;
  const recurrings = await listRecurringPickups();

  let genMessage: string | null = null;
  if (gen) {
    const [created, skipped] = gen.split("_");
    genMessage = `Generazione completata: ${created} prese create, ${skipped} già esistenti (saltate).`;
  }

  const columns: Column<RecurringWithRelations>[] = [
    {
      header: "Cliente / Località",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div>
            <Link href={`/prese-fisse/${r.id}/modifica`} className="font-medium text-brand-700 hover:underline">
              {r.customer.name}
            </Link>
            <div className="text-xs text-slate-500">
              {r.address.city} ({r.address.province})
            </div>
          </div>
          {!r.active ? <Badge tone="slate">Inattiva</Badge> : null}
        </div>
      ),
    },
    {
      header: "Giorni",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {dayDefs.map((d) =>
            r[d.key] ? (
              <Badge key={d.label} tone="blue">{d.label}</Badge>
            ) : null,
          )}
        </div>
      ),
    },
    { header: "Fascia", cell: (r) => timeWindowLabels[r.defaultTimeWindow] },
    { header: "Pallet", cell: (r) => r.defaultPallets ?? "—" },
    {
      header: "",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Link href={`/prese-fisse/${r.id}/modifica`} className="btn-secondary">Modifica</Link>
          <form action={deleteRecurringPickup}>
            <input type="hidden" name="id" value={r.id} />
            <ConfirmButton variant="danger" confirm="Eliminare questa presa fissa?">Elimina</ConfirmButton>
          </form>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Prese fisse"
        description="Ricorrenze che generano automaticamente le prese del giorno"
        action={{ href: "/prese-fisse/nuova", label: "Nuova presa fissa" }}
      />

      <div className="card mb-4 p-4">
        <div className="mb-2 text-sm font-semibold text-slate-800">
          Genera prese fisse per data selezionata
        </div>
        <GenerateRecurringForm date={tomorrowInputValue()} redirectTo="/prese-fisse" />
        {genMessage ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {genMessage}
          </p>
        ) : null}
        {genError === "date" ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Data non valida.
          </p>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={recurrings}
        empty={{
          title: "Nessuna presa fissa",
          description: "Crea una ricorrenza per generare automaticamente le prese.",
          action: { href: "/prese-fisse/nuova", label: "Nuova presa fissa" },
        }}
      />
    </div>
  );
}
