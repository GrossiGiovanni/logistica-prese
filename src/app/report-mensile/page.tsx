import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { requireBranchId } from "@/lib/branch";
import { getMonthlyStats } from "@/features/reports/monthly";
import { formatEuro } from "@/lib/costs";
import { formatDateIt, parseDateOnly } from "@/lib/dates";

const nf1 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const eur = (v: number) => (v > 0 ? formatEuro(Math.round(v)) : "—");

export default async function ReportMensilePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const branchId = await requireBranchId();
  const stats = await getMonthlyStats(branchId, month);

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

      <p className="mb-4 text-sm text-slate-500">
        Consuntivo fino a oggi ({formatDateIt(parseDateOnly(stats.today))}): solo giri confermati; le date
        future entrano solo nel forecast.
        {stats.draftRoutesCount > 0
          ? ` Esclusi ${stats.draftRoutesCount} giri in bozza (${eur(stats.draftCost)}).`
          : ""}
      </p>

      {/* Totali del mese a consuntivo */}
      <h2 className="mb-2 text-base font-semibold text-slate-900">Consuntivo del mese</h2>
      <KpiGrid>
        <KpiCard label="Prese effettuate" value={nf0.format(stats.pickupsCount)} hint="Nei giri confermati, anche arretrate" />
        <KpiCard label="Volume tassabile" value={volLabel(stats.volumeM3)} hint="Consuntivo da import AS400" />
        <KpiCard label="Pallet equivalenti" value={nf0.format(Math.round(stats.pallets))} hint="Pallet o MTL × 2,5" />
        <KpiCard label="Giri confermati" value={nf0.format(stats.routesCount)} />
        <KpiCard label="Mezzi utilizzati" value={nf0.format(stats.vehiclesUsed)} hint="Mezzi distinti nel mese" />
        <KpiCard
          label="Prese non assegnate"
          value={nf0.format(stats.unassignedPickups)}
          tone={stats.unassignedPickups > 0 ? "amber" : "green"}
          hint="Fino a oggi, senza giro confermato"
        />
      </KpiGrid>

      {/* Medie giornaliere */}
      <h2 className="mb-2 mt-8 text-base font-semibold text-slate-900">
        Medie giornaliere ({stats.operativeDays} giorni con operatività)
      </h2>
      <KpiGrid>
        <KpiCard label="Mezzi utilizzati / giorno" value={nf1.format(stats.avgVehiclesPerDay)} />
        <KpiCard label="Prese effettuate / giorno" value={nf1.format(stats.avgPickupsPerDay)} />
        <KpiCard label="Volume tassabile / giorno" value={volLabel(stats.avgVolumePerDay)} />
        <KpiCard label="Costo medio / giorno" value={eur(stats.avgCostPerDay)} />
      </KpiGrid>

      {/* Costi del mese per voce */}
      <h2 className="mb-2 mt-8 text-base font-semibold text-slate-900">Costi del mese (consuntivo)</h2>
      <KpiGrid>
        <KpiCard label="Rama Trasporti" value={eur(stats.costs.rama)} hint="Giri autisti Rama" />
        <KpiCard label="Omar Trasporti" value={eur(stats.costs.omar)} hint="Giri autisti Omar" />
        <KpiCard label="Industriale ritiri" value={eur(stats.costs.industrialeRitiri)} hint="Giri autisti Eurosarda" />
        <KpiCard label="Costo raccolta" value={eur(stats.costs.raccolta)} tone="blue" hint="Rama + Omar + Industriale ritiri" />
        <KpiCard label="Trazioni" value={eur(stats.costs.trazioni)} hint="Registro trazioni, fuori dalla raccolta" />
        <KpiCard label="Noli" value={eur(stats.costs.noli)} hint="Noli dei carichi" />
        {stats.costs.nonClassificato > 0 ? (
          <KpiCard
            label="Non classificato"
            value={eur(stats.costs.nonClassificato)}
            tone="amber"
            hint="Giri senza autista o con azienda «Altro»: verificare l'anagrafica"
          />
        ) : null}
        <KpiCard label="Costo totale" value={eur(stats.costs.total)} tone="blue" hint="Raccolta + trazioni + noli" />
      </KpiGrid>

      {/* Forecast a fine mese */}
      <h2 className="mb-2 mt-8 text-base font-semibold text-slate-900">
        Forecast a fine mese
      </h2>
      <p className="mb-3 text-sm text-slate-500">
        {stats.workdaysRemaining > 0
          ? `Registrato + ${stats.workdaysRemaining} giorni lavorativi rimanenti: ${stats.plannedWorkdays} già pianificati (giri confermati) usano il dato pianificato, gli altri la media per giorno lavorativo trascorso (${stats.workdaysElapsed}).`
          : "Mese completato: valori a consuntivo."}
      </p>
      <KpiGrid>
        <KpiCard
          label="Prese previste"
          value={nf0.format(Math.round(stats.projectedPickups))}
          tone="blue"
          hint={`effettuate ${nf0.format(stats.pickupsCount)}`}
        />
        <KpiCard
          label="Volumi previsti"
          value={volLabel(stats.projectedVolume)}
          tone="blue"
          hint={`registrati ${volLabel(stats.volumeM3)}`}
        />
        <KpiCard
          label="Costo raccolta previsto"
          value={eur(stats.projectedCosts.raccolta)}
          tone="blue"
          hint={`registrato ${eur(stats.costs.raccolta)}`}
        />
        <KpiCard
          label="Trazioni previste"
          value={eur(stats.projectedCosts.trazioni)}
          hint={`registrate ${eur(stats.costs.trazioni)}`}
        />
        <KpiCard
          label="Noli previsti"
          value={eur(stats.projectedCosts.noli)}
          hint={`registrati ${eur(stats.costs.noli)}`}
        />
        <KpiCard
          label="Costo totale previsto"
          value={eur(stats.projectedCosts.total)}
          hint={`registrato ${eur(stats.costs.total)}`}
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
