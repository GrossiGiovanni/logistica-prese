import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/ui/KpiCard";
import { Badge } from "@/components/badges/Badge";
import { RouteStatusBadge } from "@/components/badges/StatusBadge";
import { MissingDataBadge, RouteWarningBadges } from "@/components/badges/WarningBadge";
import { DateSelector } from "@/components/ui/DateSelector";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { getDailyStats } from "@/features/dashboard/queries";
import { listUnassignedPickups } from "@/features/pickups/queries";
import { assignPickupToRoute, deleteRoute, setResoRoute } from "@/features/routes/actions";
import { cancelPickup } from "@/features/pickups/actions";
import { deleteReso } from "@/features/resi/actions";
import { ensureRecurringForDate } from "@/features/recurring-pickups/generate";
import { prisma } from "@/lib/db";
import {
  routeTotalPallets,
  routeOccupiedMeters,
  routeUsesMotrice,
  getRouteWarnings,
  findResourceOverlaps,
  hasMissingData,
} from "@/lib/warnings";
import { routeTotalCost, formatEuro } from "@/lib/costs";
import { routeShiftLabels, priorityLabels, routeLabel } from "@/lib/labels";
import { formatDateIt, tomorrowInputValue, parseDateOnly, toDateInputValue } from "@/lib/dates";
import { UnassignedFilters } from "@/features/pickups/UnassignedFilters";
import { PickupShiftSelect } from "@/features/pickups/PickupShiftSelect";
import { WhatsAppButton } from "@/features/routes/WhatsAppButton";
import {
  buildWhatsappMessage,
  isValidWhatsappNumber,
  whatsappDigits,
} from "@/features/routes/whatsapp-message";
import { getPianFilters, getOpDate } from "@/lib/persisted-filters";
import type { TimeWindow, Priority } from "@prisma/client";

export default async function PianificazionePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const [saved, opDate] = await Promise.all([getPianFilters(), getOpDate()]);
  const { q, tw, prio } = saved;
  const selectedDate = date ?? opDate ?? tomorrowInputValue();
  const redirectTo = `/pianificazione?date=${selectedDate}`;

  // Materializza le prese fisse del giorno (idempotente). I giri NON sono
  // automatici: l'operatore li crea manualmente.
  await ensureRecurringForDate(selectedDate);

  const [{ routes, kpi }, unassigned, resi] = await Promise.all([
    getDailyStats(selectedDate),
    listUnassignedPickups(selectedDate, {
      search: q || undefined,
      timeWindow: (tw as TimeWindow) || undefined,
      priority: (prio as Priority) || undefined,
    }),
    prisma.reso.findMany({
      where: { resoDate: parseDateOnly(selectedDate) },
      include: {
        customer: { select: { name: true } },
        address: { select: { city: true, province: true } },
        routeStops: { select: { route: { select: { id: true, driver: { select: { name: true } }, vehicle: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Conflitti di risorsa (stesso mezzo/autista su fasce sovrapposte) — solo tra i
  // giri effettivamente impegnati (con almeno una presa): un giro vuoto non è in conflitto.
  const overlapIds = findResourceOverlaps(routes.filter((r) => r.stops.length > 0));

  return (
    <div>
      <PageHeader
        title="Pianificazione"
        description={`Schermata operativa del ${formatDateIt(parseDateOnly(selectedDate))}`}
      >
        <DateSelector value={selectedDate} label="Giorno" />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/giri/nuovo?date=${selectedDate}`} className="btn-primary">
          Nuovo giro
        </Link>
        <Link href={`/prese/nuova?date=${selectedDate}`} className="btn-secondary">
          Nuova presa
        </Link>
        <Link href={`/resi/nuovo?date=${selectedDate}`} className="btn-secondary">
          Nuovo reso
        </Link>
      </div>

      <KpiGrid>
        <KpiCard label="Prese totali" value={kpi.total} />
        <KpiCard label="Non assegnate" value={kpi.unassigned} tone={kpi.unassigned > 0 ? "amber" : "green"} />
        <KpiCard label="Dati mancanti" value={kpi.missingData} tone={kpi.missingData > 0 ? "amber" : "green"} />
        <KpiCard label="Giri" value={kpi.routesCount} />
        <KpiCard label="Mezzi usati" value={kpi.vehiclesUsed} />
        <KpiCard label="Motrici usate" value={kpi.motriciUsed} tone={kpi.motriciUsed > 0 ? "red" : "default"} />
      </KpiGrid>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* SINISTRA: prese non assegnate */}
        <div>
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            Prese non assegnate ({unassigned.length})
          </h2>
          <UnassignedFilters date={selectedDate} current={{ q, tw, prio }} />
          {unassigned.length === 0 ? (
            <div className="card px-4 py-8 text-center text-sm text-slate-500">
              Nessuna presa da assegnare con i filtri attuali.
            </div>
          ) : (
            <ul className="space-y-2">
              {unassigned.map((p) => (
                <li key={p.id} className="card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.pickupNumber ? (
                      <span className="font-mono text-xs font-semibold text-brand-700">
                        {p.pickupNumber}
                      </span>
                    ) : null}
                    <Link href={`/prese/${p.id}/modifica`} className="font-medium text-slate-800 hover:underline">
                      {p.customer.name}
                    </Link>
                    {toDateInputValue(p.pickupDate) !== selectedDate ? (
                      <Badge tone="red">Da recuperare · {formatDateIt(p.pickupDate)}</Badge>
                    ) : null}
                    {p.priority !== "NORMAL" ? <Badge tone="red">{priorityLabels[p.priority]}</Badge> : null}
                    {p.requiresMotrice ? <Badge tone="purple">Motrice</Badge> : null}
                    {p.requiresTailLift ? <Badge tone="blue">Sponda</Badge> : null}
                    {p.timeWindow === "MORNING" ? <Badge tone="amber">Mattina</Badge> : null}
                    {p.timeWindow === "AFTERNOON" ? <Badge tone="amber">Pomeriggio</Badge> : null}
                    {hasMissingData(p) ? <MissingDataBadge /> : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {p.address.city} ({p.address.province}) · {p.pallets ?? "—"} pallet
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Fascia:</span>
                    <PickupShiftSelect pickupId={p.id} value={p.timeWindow} redirectTo={redirectTo} />
                    <form action={cancelPickup} className="ml-auto">
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton
                        variant="danger"
                        className="px-2 py-1 text-xs"
                        confirm="Eliminare definitivamente questa presa? Se servirà di nuovo andrà ricreata o reimportata."
                      >
                        Annulla
                      </ConfirmButton>
                    </form>
                  </div>

                  {routes.length === 0 ? (
                    <div className="mt-2 text-xs text-slate-400">
                      Crea un giro per poter assegnare.
                    </div>
                  ) : (
                    <form action={assignPickupToRoute} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="pickupId" value={p.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <select name="routeId" required defaultValue="" className="field-input w-auto grow text-sm">
                        <option value="" disabled>Assegna al giro…</option>
                        {routes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {routeLabel(r) + " · " + routeShiftLabels[r.shift]}
                          </option>
                        ))}
                      </select>
                      <ConfirmButton variant="secondary">Assegna</ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* DESTRA: giri del giorno */}
        <div>
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            Giri del giorno ({routes.length})
          </h2>
          {routes.length === 0 ? (
            <div className="card px-4 py-8 text-center text-sm text-slate-500">
              Nessun giro. Crea il primo giro per iniziare.
            </div>
          ) : (
            <ul className="space-y-2">
              {routes.map((r) => {
                const warnings = getRouteWarnings(r);
                if (overlapIds.has(r.id)) warnings.push("resource_overlap");
                const total = routeTotalPallets(r);
                const capExceeded =
                  r.vehicle?.capacityPallets != null && total > r.vehicle.capacityPallets;
                return (
                  <li key={r.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/giri/${r.id}`} className="font-semibold text-slate-900 hover:underline">
                            {routeLabel(r)}
                          </Link>
                          {routeUsesMotrice(r) ? <Badge tone="purple">Motrice</Badge> : null}
                          <RouteStatusBadge status={r.status} />
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {routeShiftLabels[r.shift]} · {r.stops.length} prese ·{" "}
                          <span className={capExceeded ? "font-semibold text-red-600" : ""}>
                            {total}
                            {r.vehicle?.capacityPallets != null ? ` / ${r.vehicle.capacityPallets}` : ""} pallet
                          </span>
                          {` · ${routeOccupiedMeters(r)} m`}
                          {r.km != null ? ` · ${r.km} km` : ""}
                          {routeTotalCost(r) != null ? ` · ${formatEuro(routeTotalCost(r))}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {r.driver?.whatsappEnabled && r.stops.length > 0 ? (
                          isValidWhatsappNumber(r.driver.phone) ? (
                            <WhatsAppButton
                              routeId={r.id}
                              digits={whatsappDigits(r.driver.phone)}
                              message={buildWhatsappMessage(r)}
                              compact
                            />
                          ) : (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                              Numero WhatsApp mancante
                            </span>
                          )
                        ) : null}
                        <Link href={`/giri/${r.id}`} className="btn-secondary">Apri giro</Link>
                        <form action={deleteRoute}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <ConfirmButton
                            variant="danger"
                            className="px-2 py-1"
                            confirm={`Eliminare il giro "${routeLabel(r)}"? Le prese torneranno disponibili.`}
                          >
                            ✕
                          </ConfirmButton>
                        </form>
                      </div>
                    </div>
                    {warnings.length > 0 ? (
                      <div className="mt-2">
                        <RouteWarningBadges warnings={warnings} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* RESI: consegne di resi al cliente senza ritiro associato */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Resi del giorno ({resi.length})</h2>
          <Link href={`/resi/nuovo?date=${selectedDate}`} className="btn-secondary">Nuovo reso</Link>
        </div>
        {resi.length === 0 ? (
          <div className="card px-4 py-6 text-center text-sm text-slate-500">
            Nessun reso registrato per questa data.
          </div>
        ) : (
          <ul className="space-y-2">
            {resi.map((r) => (
              <li key={r.id} className="card flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.distintaNumber ? (
                      <span className="font-mono text-xs font-semibold text-brand-700">{r.distintaNumber}</span>
                    ) : null}
                    <span className="font-medium text-slate-800">{r.customer.name}</span>
                    <Badge tone="purple">Reso</Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.address ? `${r.address.city} (${r.address.province}) · ` : ""}
                    {[
                      r.resiCount != null ? `${r.resiCount} resi` : null,
                      r.pallets != null ? `${r.pallets} plt` : null,
                      r.colli != null ? `${r.colli} colli` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                    {r.notes ? ` · ${r.notes}` : ""}
                    {r.routeStops[0]?.route ? (
                      <span className="text-slate-400">
                        {" · "}Giro: {r.routeStops[0].route.driver?.name ?? "—"} / {r.routeStops[0].route.vehicle?.name ?? "—"}
                      </span>
                    ) : null}
                  </div>
                  {routes.length > 0 ? (
                    <form action={setResoRoute} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="resoId" value={r.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <select name="routeId" defaultValue={r.routeStops[0]?.route.id ?? ""} className="field-input w-auto py-1 text-xs">
                        <option value="">— Non in un giro —</option>
                        {routes.map((gr) => (
                          <option key={gr.id} value={gr.id}>{routeLabel(gr)} · {routeShiftLabels[gr.shift]}</option>
                        ))}
                      </select>
                      <button type="submit" className="btn-secondary px-2 py-1 text-xs">Assegna</button>
                    </form>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/resi/${r.id}/modifica`} className="btn-secondary">Modifica</Link>
                  <form action={deleteReso}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <ConfirmButton variant="danger" className="px-2 py-1" confirm="Eliminare questo reso?">
                      ✕
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
