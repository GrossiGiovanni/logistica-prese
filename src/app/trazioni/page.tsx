import { PageHeader } from "@/components/ui/PageHeader";
import { NewTractionForm, TractionRow } from "@/features/tractions/TractionRow";
import { listActiveDrivers } from "@/features/drivers/queries";
import { prisma } from "@/lib/db";
import { formatEuro } from "@/lib/costs";
import {
  formatDateIt,
  todayInputValue,
  addDaysInput,
  parseDateOnly,
  toDateInputValue,
  isValidDateInput,
} from "@/lib/dates";

export default async function TrazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; driverId?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from && isValidDateInput(sp.from) ? sp.from : addDaysInput(todayInputValue(), -30);
  const to = sp.to && isValidDateInput(sp.to) ? sp.to : todayInputValue();
  const driverId = sp.driverId || "";

  const [tractions, drivers] = await Promise.all([
    prisma.traction.findMany({
      where: {
        tractionDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
        ...(driverId ? { driverId } : {}),
      },
      include: { driver: { select: { name: true } } },
      orderBy: [{ tractionDate: "desc" }, { createdAt: "asc" }],
    }),
    listActiveDrivers(),
  ]);

  const back = `from=${from}&to=${to}${driverId ? `&driverId=${driverId}` : ""}`;
  const driverOptions = drivers.map((d) => ({ id: d.id, name: d.name }));
  const totKm = tractions.reduce((s, t) => s + (t.km ?? 0), 0);
  const totCost = tractions.reduce((s, t) => s + (t.cost ?? 0), 0);

  return (
    <div>
      <PageHeader title="Trazioni Eurosarda" description="Registro delle trazioni: tratta, km e costo (entra nei totali di giornata)" />

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div>
          <label className="field-label">Autista</label>
          <select name="driverId" defaultValue={driverId} className="field-input w-auto">
            <option value="">Tutti</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Da</label>
          <input type="date" name="from" defaultValue={from} className="field-input w-auto" />
        </div>
        <div>
          <label className="field-label">A</label>
          <input type="date" name="to" defaultValue={to} className="field-input w-auto" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Filtra</button>
          <a href="/trazioni" className="btn-secondary">Azzera</a>
        </div>
      </form>

      <NewTractionForm drivers={driverOptions} back={back} />

      {sp.error === "campi" ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Compila almeno data, partenza e arrivo.
        </p>
      ) : null}

      <h2 className="mb-2 text-base font-semibold text-slate-900">
        Trazioni dal {formatDateIt(parseDateOnly(from))} al {formatDateIt(parseDateOnly(to))} ({tractions.length}) · {Math.round(totKm)} km · {formatEuro(totCost)}
      </h2>
      {tractions.length === 0 ? (
        <div className="card px-4 py-6 text-center text-sm text-slate-500">
          Nessuna trazione registrata nel periodo con questi filtri.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Targa</th>
                <th className="px-3 py-2">Autista</th>
                <th className="px-3 py-2">Partenza</th>
                <th className="px-3 py-2">Arrivo</th>
                <th className="px-3 py-2">Km</th>
                <th className="px-3 py-2">Costo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {tractions.map((t) => (
                <TractionRow
                  key={t.id}
                  drivers={driverOptions}
                  back={back}
                  t={{
                    id: t.id,
                    dateInput: toDateInputValue(t.tractionDate),
                    dayLabel: formatDateIt(t.tractionDate),
                    plate: t.plate,
                    driverId: t.driverId,
                    driverName: t.driver?.name ?? null,
                    origin: t.origin,
                    destination: t.destination,
                    km: t.km,
                    cost: t.cost,
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
