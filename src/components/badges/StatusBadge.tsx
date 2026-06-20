import type { PickupStatus, RouteStatus } from "@prisma/client";
import { pickupStatusLabels, routeStatusLabels } from "@/lib/labels";
import { Badge, type BadgeTone } from "./Badge";

const pickupTone: Record<PickupStatus, BadgeTone> = {
  DRAFT: "slate",
  READY: "blue",
  PLANNED: "green",
  CANCELLED: "red",
};

const routeTone: Record<RouteStatus, BadgeTone> = {
  DRAFT: "amber",
  CONFIRMED: "green",
};

export function PickupStatusBadge({ status }: { status: PickupStatus }) {
  return <Badge tone={pickupTone[status]}>{pickupStatusLabels[status]}</Badge>;
}

export function RouteStatusBadge({ status }: { status: RouteStatus }) {
  return <Badge tone={routeTone[status]}>{routeStatusLabels[status]}</Badge>;
}
