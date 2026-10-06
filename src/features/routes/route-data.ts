// Dati del giro modificabili dal form (salvataggio esplicito e automatico).
//
// Lo STATO non è mai tra questi: il giro si conferma solo col pulsante dedicato.
// Altrimenti un form rimasto aperto (o il salvataggio automatico) potrebbe
// riportare in bozza un giro appena confermato.
import { parseDateOnly } from "@/lib/dates";
import type { z } from "zod";
import type { routeSchema } from "@/lib/validations";

type RouteInput = z.infer<typeof routeSchema>;

export function routeEditableData(data: RouteInput) {
  // "status" escluso anche qui, per difesa: lo schema già lo scarta.
  const { routeDate, driverId, vehicleId, status: _scartato, ...rest } = data as RouteInput & { status?: unknown };
  return {
    ...rest,
    routeDate: parseDateOnly(routeDate),
    driverId: driverId ?? null,
    vehicleId: vehicleId ?? null,
  };
}
