import { PageHeader } from "@/components/ui/PageHeader";
import { ImportClient } from "@/features/imports/ImportClient";
import { prisma } from "@/lib/db";

export default async function ImportaPage() {
  const logs = await prisma.importLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <PageHeader
        title="Importa prese da AS400"
        description="Carica l'estrazione Excel: vengono aggiunte solo le prese nuove (nessun duplicato, nessun giro automatico)."
      />

      <ImportClient />

      <section className="mt-8">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          Storico import ({logs.length})
        </h2>
        {logs.length === 0 ? (
          <div className="card px-4 py-6 text-center text-sm text-slate-500">
            Nessun import effettuato finora.
          </div>
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-medium text-slate-800">{l.fileName}</span>
                  <span className="text-xs text-slate-500">
                    {l.createdAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })}
                  </span>
                  <span className="text-xs">
                    Righe: {l.totalRows} · <span className="text-emerald-700">importate {l.imported}</span> ·
                    saltate {l.skipped} ·{" "}
                    <span className={l.errors > 0 ? "text-red-600" : ""}>errori {l.errors}</span>
                  </span>
                </div>
                {l.errorDetails ? (
                  <details className="mt-1 text-xs text-slate-500">
                    <summary className="cursor-pointer">Dettaglio righe scartate</summary>
                    <pre className="mt-1 whitespace-pre-wrap">{l.errorDetails}</pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
