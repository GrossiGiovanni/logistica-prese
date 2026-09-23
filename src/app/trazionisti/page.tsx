// Anagrafica trazionisti: vettori di trazione con il loro nolo predefinito.
// Il nolo qui impostato precompila il campo "Nolo" dei Carichi.

import { PageHeader } from "@/components/ui/PageHeader";
import { NewTrazionistaForm, TrazionistaRow } from "@/features/trazionisti/TrazionistaRow";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/branch";

export default async function TrazionistiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const branchId = await requireBranchId();
  const q = (sp.q ?? "").trim();

  const trazionisti = await prisma.trazionista.findMany({
    where: {
      branchId,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { carichi: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Trazionisti"
        description="Anagrafica vettori di trazione e nolo predefinito (precompila il nolo dei carichi)"
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="grow">
          <label className="field-label">Cerca trazionista</label>
          <input type="text" name="q" defaultValue={q} placeholder="Nome / vettore…" className="field-input" />
        </div>
        <button type="submit" className="btn-primary">Cerca</button>
        {q ? <a href="/trazionisti" className="btn-secondary">Azzera</a> : null}
      </form>

      <NewTrazionistaForm />

      {sp.error === "campi" ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Il nome del trazionista è obbligatorio.
        </p>
      ) : null}

      {trazionisti.length === 0 ? (
        <div className="card px-4 py-6 text-center text-sm text-slate-500">
          {q ? `Nessun trazionista corrisponde a "${q}".` : "Nessun trazionista in anagrafica."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">Nome / Vettore</th>
                <th className="px-3 py-2">Nolo predefinito</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2">Carichi</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {trazionisti.map((t) => (
                <TrazionistaRow
                  key={t.id}
                  t={{
                    id: t.id,
                    name: t.name,
                    defaultCost: t.defaultCost,
                    notes: t.notes,
                    active: t.active,
                    carichiCount: t._count.carichi,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
