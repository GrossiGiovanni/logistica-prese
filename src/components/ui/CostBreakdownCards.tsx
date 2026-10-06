// Ripartizione dei costi: stessa vista in Home, Pianificazione (giornata) e
// Report mensile. Le prime card sono le voci additive (Rama, Omar, Costo
// Industriale = ritiri + trazioni Eurosarda dai Carichi, noli esterni, non
// classificato): sommate danno il totale. Poi raccolta e totale come riepilogo.

import { KpiCard, KpiGrid } from "./KpiCard";
import { costLines, formatEuro, type CostBreakdown } from "@/lib/costs";

const eur = (v: number) => (v > 0 ? formatEuro(Math.round(v)) : "—");

export function CostBreakdownCards({
  costs,
  totalLabel = "Costo totale",
  draftCost = 0,
}: {
  costs: CostBreakdown;
  totalLabel?: string;
  /** Costo dei giri ancora in bozza: escluso dai totali, solo segnalato. */
  draftCost?: number;
}) {
  return (
    <KpiGrid>
      {costLines(costs).map((l) => (
        <KpiCard
          key={l.key}
          label={l.label}
          value={eur(l.value)}
          hint={l.hint}
          tone={l.key === "non-classificato" ? "amber" : "default"}
        />
      ))}
      <KpiCard
        label="Costo raccolta"
        value={eur(costs.raccolta)}
        hint={
          draftCost > 0
            ? `Rama + Omar + Industriale ritiri · + ${eur(draftCost)} in giri in bozza (esclusi)`
            : "Rama + Omar + Industriale ritiri"
        }
      />
      <KpiCard
        label={totalLabel}
        value={eur(costs.total)}
        hint="Somma delle voci: ritiri + trazioni Eurosarda + noli esterni"
        tone="blue"
      />
    </KpiGrid>
  );
}
