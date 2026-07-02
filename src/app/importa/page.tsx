import { PageHeader } from "@/components/ui/PageHeader";
import { ImportClient } from "@/features/imports/ImportClient";
import { clearImportLogs } from "@/features/imports/actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
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

      {logs.length > 0 ? (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700">
            Storico import ({logs.length})
          </summary>
          <div className="mt-2 space-y-2">
            <form action={clearImportLogs}>
              <ConfirmButton
                variant="danger"
                confirm="Svuotare lo storico degli import? Le prese importate NON vengono toccate."
              >
                Svuota storico
              </ConfirmButton>
            </form>
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
          </div>
        </details>
      ) : null}
    </div>
  );
}
