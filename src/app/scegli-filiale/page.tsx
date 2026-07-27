import { Logo } from "@/components/layout/Logo";
import { listBranches } from "@/lib/branch";
import { selectBranch } from "@/features/branch/actions";

export const dynamic = "force-dynamic";

export default async function ScegliFilialePage() {
  const branches = await listBranches();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto mb-6 w-40" />
        <h1 className="text-2xl font-semibold text-slate-900">Scegli la filiale</h1>
        <p className="mt-1 text-sm text-slate-500">
          Seleziona la sede su cui vuoi lavorare. I dati sono separati per filiale.
        </p>

        <div className="mt-8 grid gap-3">
          {branches.map((b) => (
            <form key={b.id} action={selectBranch}>
              <input type="hidden" name="branchId" value={b.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-brand-400 hover:bg-brand-50"
              >
                <span className="text-lg font-semibold text-slate-800">{b.name}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-500">
                  {b.code}
                </span>
              </button>
            </form>
          ))}
          {branches.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Nessuna filiale attiva configurata.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
