import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { requireBranchId } from "@/lib/branch";
import { getMonthlyStats } from "@/features/reports/monthly";
import { formatEuro } from "@/lib/costs";
import { todayInputValue } from "@/lib/dates";

const nf1 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const eur = (v: number) => (v > 0 ? formatEuro(Math.round(v)) : "—");

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const branchId = await requireBranchId();
  const stats = await getMonthlyStats(branchId, month);
  const today = todayInputValue();

  const volLabel = (v: number) => `${nf1.format(Math.round(v * 10) / 10)} m³`;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Panoramica del mese — ${stats.monthLabel}`}
      >
        <form method="get" className="flex items-end gap-2">
          <input type="month" name="month" defaultValue={stats.month} className="field-input w-auto" />
          <button type="submit" className="btn-secondary">Vai</button>
        </form>
        <Link href={`/pianificazione?date=${today}`} className="btn-primary">
          Vai alla pianificazione
        </Link>
      </PageHeader>

      {/* KPI operativi del mese */}
      <KpiGrid>
        <KpiCard
          label="Prese effettuate"
          value={nf0.format(stats.pickupsCount)}
          hint={`≈ ${nf1.format(stats.avgPickupsPerDay)} / giorno operativo · fino a oggi`}
        />
        <KpiCard
          label="Volume tassabile"
          value={volLabel(stats.volumeM3)}
          hint="Consuntivo da import AS400"
        />
        <KpiCard
          label="Giri confermati"
          value={nf0.format(stats.routesCount)}
          hint={stats.draftRoutesCount > 0 ? `+ ${stats.draftRoutesCount} in bozza (esclusi)` : undefined}
        />
        <KpiCard label="Pallet equivalenti" value={nf0.format(Math.round(stats.pallets))} hint="Pallet o MTL × 2,5" />
        <KpiCard label="Mezzi medi / giorno" value={nf1.format(stats.avgVehiclesPerDay)} />
        <KpiCard
          label="Giorni operativi"
          value={`${stats.operativeDays} / ${stats.workdaysTotal}`}
          hint="Con attività / lavorativi"
        />
      </KpiGrid>

      {/* Costi del mese, separati per voce */}
      <h2 className="mb-2 mt-8 text-base font-semibold text-slate-900">Costi del mese (fino a oggi)</h2>
      <KpiGrid>
        <KpiCard label="Rama Trasporti" value={eur(stats.costs.rama)} />
        <KpiCard label="Omar Trasporti" value={eur(stats.costs.omar)} />
        <KpiCard label="Industriale ritiri" value={eur(stats.costs.industrialeRitiri)} hint="Giri autisti Eurosarda" />
        <KpiCard label="Costo raccolta" value={eur(stats.costs.raccolta)} tone="blue" hint="Rama + Omar + Industriale ritiri" />
        <KpiCard label="Trazioni" value={eur(stats.costs.trazioni)} />
        <KpiCard label="Noli" value={eur(stats.costs.noli)} />
        {stats.costs.nonClassificato > 0 ? (
          <KpiCard label="Non classificato" value={eur(stats.costs.nonClassificato)} tone="amber" hint="Verificare l'azienda degli autisti" />
        ) : null}
        <KpiCard label="Costo totale" value={eur(stats.costs.total)} hint="Raccolta + trazioni + noli" />
      </KpiGrid>

      {/* Classifiche + forecast */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Top cliente */}
        <div className="card p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Top cliente
          </div>
          {stats.topCustomer ? (
            <>
              <div className="mt-1 truncate text-xl font-bold text-slate-900" title={stats.topCustomer.name}>
                {stats.topCustomer.name}
              </div>
              <div className="mt-0.5 text-sm text-slate-500">
                {nf0.format(stats.topCustomer.count)} prese · {volLabel(stats.topCustomer.volume)}
              </div>
            </>
          ) : (
            <div className="mt-1 text-xl font-bold text-slate-300">—</div>
          )}
        </div>

        {/* Top autista */}
        <div className="card p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Top autista
          </div>
          {stats.topDriver ? (
            <>
              <div className="mt-1 truncate text-xl font-bold text-slate-900" title={stats.topDriver.name}>
                {stats.topDriver.name}
              </div>
              <div className="mt-0.5 text-sm text-slate-500">
                {nf0.format(stats.topDriver.pickups)} prese · {nf0.format(stats.topDriver.routes)} giri
              </div>
            </>
          ) : (
            <div className="mt-1 text-xl font-bold text-slate-300">—</div>
          )}
        </div>

        {/* Forecast fine mese */}
        <div className="card border-brand-200 bg-brand-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wide text-brand-600">
              Forecast fine mese
            </div>
            <Link href={`/report-mensile?month=${stats.month}`} className="text-xs text-brand-700 hover:underline">
              Dettaglio →
            </Link>
          </div>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Prese previste</dt>
              <dd className="font-semibold text-slate-800">{nf0.format(Math.round(stats.projectedPickups))}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Volume tassabile previsto</dt>
              <dd className="font-semibold text-slate-800">{volLabel(stats.projectedVolume)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Costo raccolta previsto</dt>
              <dd className="font-semibold text-brand-700">
                {eur(stats.projectedCosts.raccolta)}
              </dd>
            </div>
          </dl>
          {stats.workdaysRemaining > 0 ? (
            <div className="mt-2 text-xs text-slate-400">
              Proiezione su {stats.workdaysRemaining} giorni lavorativi rimanenti.
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-400">Mese completato: valori a consuntivo.</div>
          )}
        </div>
      </div>

      {/* Accessi rapidi operativi */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/pianificazione?date=${today}`} className="btn-secondary">Pianificazione di oggi</Link>
        <Link href="/prese" className="btn-secondary">Prese</Link>
        <Link href="/giri" className="btn-secondary">Giri</Link>
        <Link href="/importa" className="btn-secondary">Importa prese da AS400</Link>
        <Link href={`/report-mensile?month=${stats.month}`} className="btn-secondary">Report mensile</Link>
      </div>
    </div>
  );
}
