import {
  pickupWarningLabels,
  pickupWarningTone,
  routeWarningLabels,
  routeWarningTone,
  type PickupWarning,
  type RouteWarning,
} from "@/lib/warnings";
import { Badge, type BadgeTone } from "./Badge";

const toneMap: Record<"red" | "amber" | "blue", BadgeTone> = {
  red: "red",
  amber: "amber",
  blue: "blue",
};

export function PickupWarningBadges({ warnings }: { warnings: PickupWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {warnings.map((w) => (
        <Badge key={w} tone={toneMap[pickupWarningTone[w]]}>
          {pickupWarningLabels[w]}
        </Badge>
      ))}
    </div>
  );
}

export function RouteWarningBadges({ warnings }: { warnings: RouteWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {warnings.map((w) => (
        <Badge key={w} tone={toneMap[routeWarningTone[w]]}>
          {routeWarningLabels[w]}
        </Badge>
      ))}
    </div>
  );
}

/** Badge generico "Dati mancanti". */
export function MissingDataBadge() {
  return <Badge tone="amber">Dati mancanti</Badge>;
}
