import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { requireBranchId } from "@/lib/branch";
import { getMonthlyStats } from "@/features/reports/monthly";
import { formatEuro } from "@/lib/costs";
import { todayInputValue } from "@/lib/dates";

const nf1 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const branchId = await requireBranchId();
  const stats = await getMonthlyStats(branchId, month ?? "");
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
          label="Prese del mese"
          value={nf0.format(stats.pickupsCount)}
          hint={`≈ ${nf1.format(stats.avgPickupsPerDay)} / giorno operativo`}
        />
        <KpiCard
          label="Volume tassabile"
          value={volLabel(stats.volumeM3)}
          hint="Consuntivo da import AS400"
        />
        <KpiCard label="Giri del mese" value={nf0.format(stats.routesCount)} />
        <KpiCard label="Pallet del mese" value={nf0.format(stats.pallets)} />
        <KpiCard label="Mezzi medi / giorno" value={nf1.format(stats.avgVehiclesPerDay)} />
        <KpiCard
          label="Giorni operativi"
          value={`${stats.operativeDays} / ${stats.workdaysTotal}`}
          hint="Con attività / lavorativi"
        />
      </KpiGrid>

      {/* Costi del mese, separati per tipologia */}
      <h2 className="mb-2 mt-8 text-base font-semibold text-slate-900">Costi del mese</h2>
      <KpiGrid>
        <KpiCard
          label="Costo padroncini"
          value={stats.costSplit.padroncini > 0 ? formatEuro(Math.round(stats.costSplit.padroncini)) : "—"}
          hint="Giri e trazioni esterni + noli"
        />
        <KpiCard
          label="Costo industriale"
          value={stats.costSplit.industrial > 0 ? formatEuro(Math.round(stats.costSplit.industrial)) : "—"}
          hint="Autisti marcati in anagrafica"
        />
        <KpiCard
          label="Costo totale"
          value={stats.costSplit.total > 0 ? formatEuro(Math.round(stats.costSplit.total)) : "—"}
          tone="blue"
        />
        <KpiCard
          label="Costo raccolta previsto"
          value={stats.projectedCost > 0 ? formatEuro(Math.round(stats.projectedCost)) : "—"}
          hint="Registrato + proiezione fine mese"
        />
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
                {stats.projectedCost > 0 ? formatEuro(Math.round(stats.projectedCost)) : "—"}
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
