"use client";

// Selettore fascia operativa (Mattina/Pomeriggio/Giornata intera) inline su una
// presa, usato in pianificazione. Si applica al cambio, senza pulsante.

import { setPickupTimeWindow } from "./actions";
import { pickupShiftOptions } from "@/lib/labels";
import type { TimeWindow } from "@prisma/client";

export function PickupShiftSelect({
  pickupId,
  value,
  redirectTo,
}: {
  pickupId: string;
  value: TimeWindow;
  redirectTo: string;
}) {
  const normalized =
    value === "MORNING" || value === "AFTERNOON" ? value : "ANYTIME";
  return (
    <form action={setPickupTimeWindow}>
      <input type="hidden" name="pickupId" value={pickupId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <select
        name="timeWindow"
        defaultValue={normalized}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="field-input w-auto py-1 text-xs"
        title="Fascia operativa della presa"
      >
        {pickupShiftOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </form>
  );
}
