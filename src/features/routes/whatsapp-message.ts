// Costruzione del messaggio WhatsApp del giro (testo precompilato).
// Modulo puro (nessuna dipendenza server): usabile sia lato server sia client.

import type { TimeWindow, RouteShift } from "@prisma/client";
import { WAREHOUSE_ADDRESS } from "@/lib/distance";
import { timeWindowLabels, routeLabel } from "@/lib/labels";
import { formatDateIt } from "@/lib/dates";

type StopLite = {
  pickup: {
    pickupNumber: string | null;
    pallets: number | null;
    timeWindow: TimeWindow;
    rawNotes: string | null;
    customer: { name: string };
    address: { street: string; city: string; province: string };
  };
};

export type WhatsappRoute = {
  routeDate: Date;
  shift: RouteShift;
  km: number | null;
  driver: { name: string } | null;
  vehicle: { name: string } | null;
  stops: StopLite[];
};

/** Numero solo cifre per wa.me (rimuove +, spazi, ecc.). */
export function whatsappDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/[^0-9]/g, "");
}

/** True se il numero è plausibile per WhatsApp (almeno 8 cifre). */
export function isValidWhatsappNumber(phone: string | null | undefined): boolean {
  return whatsappDigits(phone).length >= 8;
}

/** Testo del messaggio da inviare all'autista (solo testo, niente emoji). */
export function buildWhatsappMessage(route: WhatsappRoute): string {
  const lines: string[] = [];
  lines.push(`*${routeLabel(route)}*`);
  lines.push(`Data: ${formatDateIt(route.routeDate)}`);
  if (route.vehicle) lines.push(`Mezzo: ${route.vehicle.name}`);
  if (route.km != null) lines.push(`Km totali: ${route.km} km`);
  lines.push(`Partenza: ${WAREHOUSE_ADDRESS}`);
  lines.push("");
  lines.push(`PRESE (${route.stops.length}):`);

  route.stops.forEach((s, i) => {
    const p = s.pickup;
    const num = p.pickupNumber ? `[${p.pickupNumber}] ` : "";
    lines.push(`${i + 1}) ${num}${p.customer.name}`);
    lines.push(`   ${p.address.street}, ${p.address.city} (${p.address.province})`);
    const meta = [
      timeWindowLabels[p.timeWindow],
      p.pallets != null ? `${p.pallets} pallet` : null,
    ]
      .filter(Boolean)
      .join(" - ");
    if (meta) lines.push(`   ${meta}`);
    if (p.rawNotes) lines.push(`   Note: ${p.rawNotes}`);
  });

  lines.push("");
  lines.push(`Rientro: ${WAREHOUSE_ADDRESS}`);
  return lines.join("\n");
}
