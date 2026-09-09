// "Carichi": gestione manuale delle informazioni di carico per il magazzino.
// Schermata scollegata da prese e giri (nessun legame con la pianificazione).

import { PageHeader } from "@/components/ui/PageHeader";
import { NewCaricoForm, CaricoRow } from "@/features/carichi/CaricoRow";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/branch";
import {
  formatDateIt,
  todayInputValue,
  addDaysInput,
  parseDateOnly,
  toDateInputValue,
  isValidDateInput,
} from "@/lib/dates";

export default async function CarichiPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; carrier?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const branchId = await requireBranchId();
  // Default: ultimi 30 giorni.
  const from = sp.from && isValidDateInput(sp.from) ? sp.from : addDaysInput(todayInputValue(), -30);
  const to = sp.to && isValidDateInput(sp.to) ? sp.to : todayInputValue();
  const carrier = (sp.carrier ?? "").trim();

  const [carichi, allCarriers] = await Promise.all([
    prisma.carico.findMany({
      where: {
        branchId,
        loadDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
        ...(carrier ? { carrier: { contains: carrier, mode: "insensitive" as const } } : {}),
      },
      orderBy: [{ loadDate: "desc" }, { createdAt: "asc" }],
    }),
    // Vettori già usati, per l'autocompletamento del campo.
    prisma.carico.findMany({
      where: { branchId },
      select: { carrier: true },
      distinct: ["carrier"],
      orderBy: { carrier: "asc" },
    }),
  ]);

  const back = `from=${from}&to=${to}${carrier ? `&carrier=${encodeURIComponent(carrier)}` : ""}`;
  const carriers = allCarriers.map((c) => c.carrier);
  const totPallets = carichi.reduce((s, c) => s + (c.pallets ?? 0), 0);
  const totColli = carichi.reduce((s, c) => s + (c.colli ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Carichi"
        description="Informazioni di carico inserite manualmente, indipendenti da prese e giri"
      >
        <a
          href={`/api/export?type=carichi&from=${from}&to=${to}${carrier ? `&carrier=${encodeURIComponent(carrier)}` : ""}`}
          className="btn-secondary"
        >
          Export Excel
        </a>
      </PageHeader>

      {/* Filtri: data + vettore */}
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div>
          <label className="field-label">Da</label>
          <input type="date" name="from" defaultValue={from} className="field-input w-auto" />
        </div>
        <div>
          <label className="field-label">A</label>
          <input type="date" name="to" defaultValue={to} className="field-input w-auto" />
        </div>
        <div>
          <label className="field-label">Vettore</label>
          <input
            name="carrier"
            defaultValue={carrier}
            placeholder="Tutti"
            list="carichi-filtro-vettori"
            className="field-input w-48"
          />
          <datalist id="carichi-filtro-vettori">
            {carriers.map((v) => <option key={v} value={v} />)}
          </datalist>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Filtra</button>
          <a href="/carichi" className="btn-secondary">Azzera</a>
        </div>
      </form>

      {/* Inserimento nuovo carico */}
      <NewCaricoForm carriers={carriers} back={back} />

      {sp.error === "campi" ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Compila almeno data e vettore.
        </p>
      ) : null}

      <h2 className="mb-2 text-base font-semibold text-slate-900">
        Carichi dal {formatDateIt(parseDateOnly(from))} al {formatDateIt(parseDateOnly(to))} ({carichi.length})
        {totPallets > 0 ? ` · ${totPallets} pallet` : ""}
        {totColli > 0 ? ` · ${totColli} colli` : ""}
      </h2>

      {carichi.length === 0 ? (
        <div className="card px-4 py-6 text-center text-sm text-slate-500">
          Nessun carico registrato nel periodo con questi filtri.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Vettore</th>
                <th className="px-3 py-2">Targa</th>
                <th className="px-3 py-2">Destinazione</th>
                <th className="px-3 py-2">Riferimento</th>
                <th className="px-3 py-2">Pallet</th>
                <th className="px-3 py-2">Colli</th>
                <th className="px-3 py-2">Peso</th>
                <th className="px-3 py-2">Volume</th>
                <th className="px-3 py-2">Note di carico</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {carichi.map((c) => (
                <CaricoRow
                  key={c.id}
                  carriers={carriers}
                  back={back}
                  c={{
                    id: c.id,
                    dateInput: toDateInputValue(c.loadDate),
                    dayLabel: formatDateIt(c.loadDate),
                    carrier: c.carrier,
                    plate: c.plate,
                    destination: c.destination,
                    reference: c.reference,
                    pallets: c.pallets,
                    colli: c.colli,
                    weightKg: c.weightKg,
                    volumeM3: c.volumeM3,
                    notes: c.notes,
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
