import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { createTrailerLog, deleteTrailerLog } from "@/features/trailer-logs/actions";
import { listEurosardaDrivers } from "@/features/drivers/queries";
import { prisma } from "@/lib/db";
import { formatDateIt, todayInputValue, parseDateOnly, isValidDateInput } from "@/lib/dates";

export default async function AutistiEurosardaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; error?: string }>;
}) {
  const { date, error } = await searchParams;
  const selectedDate = date && isValidDateInput(date) ? date : todayInputValue();

  const [logs, drivers] = await Promise.all([
    prisma.trailerLog.findMany({
      // Solo registrazioni di autisti con flag "Autista Eurosarda" attivo.
      where: { logDate: parseDateOnly(selectedDate), driver: { isEurosarda: true } },
      include: { driver: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    listEurosardaDrivers(),
  ]);

  type Row = (typeof logs)[number];
  const columns: Column<Row>[] = [
    { header: "Giorno", cell: (l) => <span className="whitespace-nowrap">{formatDateIt(l.logDate)}</span> },
    { header: "Autista", cell: (l) => <span className="font-medium text-slate-800">{l.driver.name}</span> },
    { header: "Targa semirimorchio", cell: (l) => <span className="font-mono">{l.trailerPlate}</span> },
    { header: "Servizio effettuato", cell: (l) => l.service },
    {
      header: "",
      className: "text-right",
      cell: (l) => (
        <form action={deleteTrailerLog}>
          <input type="hidden" name="id" value={l.id} />
          <input type="hidden" name="date" value={selectedDate} />
          <ConfirmButton variant="danger" confirm="Eliminare questa registrazione?">
            Elimina
          </ConfirmButton>
        </form>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Autisti Eurosarda"
        description="Registro manuale: semirimorchio agganciato in porto e servizio effettuato"
      />

      {/* Ricerca per data */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="field-label">Giorno</label>
          <input type="date" name="date" defaultValue={selectedDate} className="field-input w-auto" />
        </div>
        <button type="submit" className="btn-secondary">Vai al giorno</button>
      </form>

      {drivers.length === 0 ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Nessun autista con il flag &quot;Autista Eurosarda&quot;. Attivalo dalla scheda autista
          (Anagrafica → Autisti → Modifica).
        </p>
      ) : null}

      {/* Inserimento nuova registrazione */}
      <form action={createTrailerLog} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="field-label">Giorno *</label>
          <input type="date" name="logDate" defaultValue={selectedDate} required className="field-input w-auto" />
        </div>
        <div>
          <label className="field-label">Autista *</label>
          <select name="driverId" required defaultValue="" className="field-input w-auto">
            <option value="" disabled>Seleziona…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Targa semirimorchio *</label>
          <input name="trailerPlate" required placeholder="es. XA123BC" className="field-input w-40" />
        </div>
        <div className="grow">
          <label className="field-label">Servizio effettuato *</label>
          <input name="service" required placeholder="es. Ritiro porto Genova → magazzino" className="field-input" />
        </div>
        <button type="submit" className="btn-primary">Registra</button>
      </form>

      {error === "campi" ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Compila tutti i campi (giorno, autista, targa, servizio).
        </p>
      ) : null}

      <h2 className="mb-2 text-base font-semibold text-slate-900">
        Registrazioni del {formatDateIt(parseDateOnly(selectedDate))} ({logs.length})
      </h2>
      <DataTable
        columns={columns}
        rows={logs}
        empty={{
          title: "Nessuna registrazione",
          description: "Nessun aggancio registrato per questa data.",
        }}
      />
    </div>
  );
}
