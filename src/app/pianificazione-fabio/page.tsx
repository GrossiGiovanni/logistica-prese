// "Pianificazione Fabio": quattro viste della pianificazione affiancate (2x2),
// ognuna con filtri PROPRI e indipendenti. Serve a confrontare quattro
// pianificazioni/filtri diversi contemporaneamente senza cambiare pagina.
// NB: non sostituisce la Pianificazione standard; ne riusa la stessa logica.

import { PageHeader } from "@/components/ui/PageHeader";
import { requireBranchId, listBranches } from "@/lib/branch";
import { getOpDate } from "@/lib/persisted-filters";
import { tomorrowInputValue, isValidDateInput } from "@/lib/dates";
import { getQuadrantData, type QuadrantFilters } from "@/features/plan-fabio/queries";
import { Quadrant } from "@/features/plan-fabio/Quadrant";
import type { QuadrantCurrent } from "@/features/plan-fabio/QuadrantFilters";

export default async function PianificazioneFabioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [defaultBranch, branches, opDate] = await Promise.all([
    requireBranchId(),
    listBranches(),
    getOpDate(),
  ]);
  const activeIds = new Set(branches.map((b) => b.id));
  const baseDate = opDate ?? tomorrowInputValue();

  // Estrae i filtri del quadrante q dai parametri "qN_*" dell'URL.
  function parse(q: number): { filters: QuadrantFilters; current: QuadrantCurrent } {
    const g = (k: string) => sp[`q${q}_${k}`] ?? "";
    let branchId = g("branch");
    if (!branchId || !activeIds.has(branchId)) branchId = defaultBranch;
    const date = isValidDateInput(g("date")) ? g("date") : baseDate;
    const customerId = g("cust");
    const driverId = g("driver");
    const vehicleId = g("vehicle");
    const shift = g("shift");
    const status = g("status");
    const routeId = g("route");
    const unassignedOnly = g("unassigned") === "1";

    return {
      filters: {
        branchId,
        date,
        customerId: customerId || undefined,
        driverId: driverId || undefined,
        vehicleId: vehicleId || undefined,
        shift: shift || undefined,
        status: status || undefined,
        unassignedOnly,
        routeId: routeId || undefined,
      },
      current: {
        branchId,
        date,
        customerId,
        driverId,
        vehicleId,
        shift,
        status,
        unassignedOnly,
        routeId,
      },
    };
  }

  const parsed = [1, 2, 3, 4].map(parse);
  const data = await Promise.all(parsed.map((p) => getQuadrantData(p.filters)));
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        title="Pianificazione Fabio"
        description="Quattro viste della pianificazione a confronto, ognuna con filtri indipendenti"
      />

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        {parsed.map((p, i) => (
          <Quadrant
            key={i}
            q={i + 1}
            branchName={branchName(p.filters.branchId)}
            current={p.current}
            data={data[i]}
            branches={branches}
          />
        ))}
      </div>
    </div>
  );
}
