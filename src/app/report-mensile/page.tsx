import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { requireBranchId } from "@/lib/branch";
import { getMonthlyStats } from "@/features/reports/monthly";
import { formatEuro } from "@/lib/costs";

const nf1 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

export default async function ReportMensilePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const branchId = await requireBranchId();
  const stats = await getMonthlyStats(branchId, month ?? "");

  const volLabel = (v: number) => `${nf1.format(Math.round(v * 10) / 10)} m³`;

  return (
    <div>
      <PageHeader
        title="Report mensile"
        description={`Medie, forecast e controllo km — ${stats.monthLabel}`}
      >
        <form method="get" className="flex items-end gap-2">
          <input type="month" name="month" defaultValue={stats.month} className="field-input w-auto" />
          <button type="submit" className="btn-secondary">Vai</button>
        </form>
      </PageHeader>

      {/* Medie giornaliere */}
      <h2 className="mb-2 text-base font-semibold text-slate-900">
        Medie giornaliere ({stats.operativeDays} giorni con operatività)
      </h2>
      <KpiGrid>
        <KpiCard label="Mezzi utilizzati / giorno" value={nf1.format(stats.avgVehiclesPerDay)} />
        <KpiCard label="Prese effettuate / giorno" value={nf1.format(stats.avgPickupsPerDay)} />
        <KpiCard label="Volume tassabile / giorno" value={volLabel(stats.avgVolumePerDay)} />
        <KpiCard
          label="Costo medio / giorno"
          value={stats.avgCostPerDay > 0 ? formatEuro(Math.round(stats.avgCostPerDay)) : "—"}
        />
      </KpiGrid>

      {/* Ripartizione costi del mese */}
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
          hint="Giri e trazioni autisti Eurosarda"
        />
        <KpiCard
          label="Costo totale"
          value={stats.costSplit.total > 0 ? formatEuro(Math.round(stats.costSplit.total)) : "—"}
          tone="blue"
        />
        <KpiCard
          label="di cui noli carichi"
          value={stats.noliCost > 0 ? formatEuro(Math.round(stats.noliCost)) : "—"}
          hint="Trazioni registrate nei Carichi"
        />
      </KpiGrid>

      {/* Forecast a fine mese: prese + volumi + costo raccolta previsti */}
      <h2 className="mb-2 mt-8 text-base font-semibold text-slate-900">
        Forecast a fine mese
      </h2>
      <p className="mb-3 text-sm text-slate-500">
        Registrato finora + proiezione sui{" "}
        {stats.workdaysRemaining > 0 ? `${stats.workdaysRemaining} giorni lavorativi rimanenti` : "valori a consuntivo (mese completato)"}.
      </p>
      <KpiGrid>
        <KpiCard
          label="Prese previste"
          value={nf0.format(Math.round(stats.projectedPickups))}
          tone="blue"
          hint={`registrate ${nf0.format(stats.pickupsCount)}`}
        />
        <KpiCard
          label="Volumi previsti"
          value={volLabel(stats.projectedVolume)}
          tone="blue"
          hint={`registrati ${volLabel(stats.volumeM3)}`}
        />
        <KpiCard
          label="Costo raccolta previsto"
          value={stats.projectedCost > 0 ? formatEuro(Math.round(stats.projectedCost)) : "—"}
          tone="blue"
          hint={`registrato ${stats.registeredCost > 0 ? formatEuro(Math.round(stats.registeredCost)) : "—"}`}
        />
        <KpiCard
          label="Giorni lavorativi mancanti"
          value={nf0.format(stats.workdaysRemaining)}
          hint={`su ${stats.workdaysTotal} del mese`}
        />
      </KpiGrid>

      {/* Controllo km autisti */}
      <h2 className="mb-2 mt-8 text-base font-semibold text-slate-900">
        Chilometri autisti — limite mensile teorico ({stats.workdaysTotal} giorni lavorativi: bilico 300 km/g, motrice 250 km/g)
      </h2>
      {stats.kmRows.length === 0 ? (
        <div className="card px-4 py-6 text-center text-sm text-slate-500">
          Nessun autista attivo per questa filiale.
        </div>
      ) : (
        <div className="space-y-2">
          {stats.kmRows.map((d) => {
            const clamped = Math.min(d.pct, 100);
            const barColor = d.pct >= 100 ? "bg-red-500" : d.pct >= 80 ? "bg-amber-500" : "bg-brand-600";
            const residui = Math.round((d.monthlyLimit - d.km) * 10) / 10;
            return (
              <div key={d.id} className="card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800">{d.name}</span>
                  <span className="text-xs text-slate-500">
                    {d.km} km / {d.monthlyLimit} km · residui {residui} km ·{" "}
                    <span className={d.pct >= 100 ? "font-semibold text-red-600" : d.pct >= 80 ? "font-semibold text-amber-600" : ""}>
                      {d.pct.toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${clamped}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
