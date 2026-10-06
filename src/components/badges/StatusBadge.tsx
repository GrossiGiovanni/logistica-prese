import type { RouteStatus } from "@prisma/client";
import { routeStatusLabels } from "@/lib/labels";
import {
  pickupOperationalStatusLabels,
  type PickupOperationalStatus,
} from "@/lib/pickup-status";
import { Badge, type BadgeTone } from "./Badge";

// Stato della presa CALCOLATO (giro / dati di carico / annullata), mai salvato a mano.
const pickupTone: Record<PickupOperationalStatus, BadgeTone> = {
  DA_COMPLETARE: "slate",
  PRONTA: "blue",
  PIANIFICATA: "green",
  ANNULLATA: "red",
};

const routeTone: Record<RouteStatus, BadgeTone> = {
  DRAFT: "amber",
  CONFIRMED: "green",
};

export function PickupStatusBadge({ status }: { status: PickupOperationalStatus }) {
  return <Badge tone={pickupTone[status]}>{pickupOperationalStatusLabels[status]}</Badge>;
}

export function RouteStatusBadge({ status }: { status: RouteStatus }) {
  return <Badge tone={routeTone[status]}>{routeStatusLabels[status]}</Badge>;
}
