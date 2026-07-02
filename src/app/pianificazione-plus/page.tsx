import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DateSelector } from "@/components/ui/DateSelector";
import { PlusBoard, type PlusPickup, type PlusRoute } from "@/features/plus/PlusBoard";
import { listUnassignedPickups } from "@/features/pickups/queries";
import { listRoutes } from "@/features/routes/queries";
import { ensureRecurringForDate } from "@/features/recurring-pickups/generate";
import { getOpDate } from "@/lib/persisted-filters";
import {
  getRouteWarnings,
  findResourceOverlaps,
  routeTotalPallets,
  routeOccupiedMeters,
  pickupPalletEquivalent,
  pickupMetersEquivalent,
  pickupFitsShift,
  hasLoadData,
  routeWarningLabels,
} from "@/lib/warnings";
import { WAREHOUSE_COORDS, addressToQuery, fetchRoutePolyline } from "@/lib/distance";
import {
  timeWindowLabels,
  priorityLabels,
  pickupStatusLabels,
  routeShiftLabels,
  routeLabel,
} from "@/lib/labels";
import { formatDateIt, tomorrowInputValue, parseDateOnly, toDateInputValue } from "@/lib/dates";

// Palette colori dei giri (ciclica)
const COLORS = [
  "#2563eb", "#16a34a", "#ea580c", "#9333ea", "#dc2626",
  "#0891b2", "#ca8a04", "#db2777", "#4f46e5", "#059669",
];

type PickupSource = {
  id: string;
  pickupNumber: string | null;
  pickupDate: Date;
  pallets: number | null;
  loadingMeters: number | null;
  volumeM3: number | null;
  timeWindow: keyof typeof timeWindowLabels;
  priority: keyof typeof priorityLabels;
  requiresMotrice: boolean;
  status: keyof typeof pickupStatusLabels;
  rawNotes: string | null;
  customer: { name: string };
  address: { street: string; city: string; province: string; lat: number | null; lng: number | null };
};

function toPlusPickup(p: PickupSource, selectedDate: string): PlusPickup {
  return {
    id: p.id,
    numero: p.pickupNumber,
    customer: p.customer.name,
    address: `${p.address.street}, ${p.address.city} (${p.address.province})`,
    lat: p.address.lat,
    lng: p.address.lng,
    palletEq: Math.round(pickupPalletEquivalent(p)),
    metersEq: Math.round(pickupMetersEquivalent(p) * 10) / 10,
    timeWindow: p.timeWindow,
    timeLabel: timeWindowLabels[p.timeWindow],
    priority: p.priority,
    priorityLabel: priorityLabels[p.priority],
    requiresMotrice: p.requiresMotrice,
    statusLabel: pickupStatusLabels[p.status],
    notes: p.rawNotes,
    isBacklog: toDateInputValue(p.pickupDate) !== selectedDate,
    dateLabel: formatDateIt(p.pickupDate),
  };
}

export default async function PianificazionePlusPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const selectedDate = date ?? (await getOpDate()) ?? tomorrowInputValue();

  await ensureRecurringForDate(selectedDate);

  const [unassignedRaw, routesRaw] = await Promise.all([
    listUnassignedPickups(selectedDate),
    listRoutes(selectedDate),
  ]);

  const overlapIds = findResourceOverlaps(routesRaw.filter((r) => r.stops.length > 0));

  // Percorsi (polyline) dei giri con fermate, in parallelo.
  const polylines = await Promise.all(
    routesRaw.map((r) =>
      r.stops.length > 0
        ? fetchRoutePolyline(r.stops.map((s) => addressToQuery(s.pickup.address)))
        : Promise.resolve(null),
    ),
  );

  const routes: PlusRoute[] = routesRaw.map((r, i) => {
    const warnings = getRouteWarnings(r).map((w) => routeWarningLabels[w]);
    if (overlapIds.has(r.id)) warnings.push(routeWarningLabels.resource_overlap);
    return {
      id: r.id,
      label: routeLabel(r),
      shiftLabel: routeShiftLabels[r.shift],
      km: r.km,
      palletTot: routeTotalPallets(r),
      metersTot: routeOccupiedMeters(r),
      capacity: r.vehicle?.capacityPallets ?? null,
      warnings,
      color: COLORS[i % COLORS.length],
      polyline: polylines[i],
      stops: r.stops.map((s) => ({
        seq: s.sequence,
        warnings: [
          !pickupFitsShift(s.pickup.timeWindow, r.shift) ? "Fascia diversa dal giro" : null,
          !hasLoadData(s.pickup) ? "Carico mancante" : null,
        ].filter((w): w is string => w != null),
        pickup: toPlusPickup(s.pickup, selectedDate),
      })),
    };
  });

  const unassigned: PlusPickup[] = unassignedRaw.map((p) => toPlusPickup(p, selectedDate));

  return (
    <div>
      <PageHeader
        title="Pianificazione Plus"
        description={`Lavagna operativa del ${formatDateIt(parseDateOnly(selectedDate))} — prese e giri su mappa`}
      >
        <DateSelector value={selectedDate} label="Giorno" />
        <Link href={`/pianificazione?date=${selectedDate}`} className="btn-secondary">
          Pianificazione classica
        </Link>
      </PageHeader>

      <PlusBoard
        warehouse={WAREHOUSE_COORDS}
        unassigned={unassigned}
        routes={routes}
        date={selectedDate}
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
      />
    </div>
  );
}
