"use client";

// Modifica rapida dei quantitativi di una presa dalla sezione giri:
// pallet, metri lineari, colli, peso, volume. Al salvataggio la pagina si
// ricarica e riepiloghi/capacità/warning si aggiornano.

import { useState } from "react";
import { updatePickupQuantities } from "@/features/pickups/actions";

export function StopQuantityEdit({
  pickupId,
  redirectTo,
  values,
}: {
  pickupId: string;
  redirectTo: string;
  values: {
    pallets: number | null;
    loadingMeters: number | null;
    colli: number | null;
    weightKg: number | null;
    volumeM3: number | null;
  };
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 text-xs font-medium text-brand-700 hover:underline"
      >
        Modifica quantità
      </button>
    );
  }

  return (
    <form action={updatePickupQuantities} className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <input type="hidden" name="id" value={pickupId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="text-[11px] text-slate-500">
          Pallet
          <input name="pallets" type="number" min={0} defaultValue={values.pallets ?? ""} className="field-input py-1 text-xs" />
        </label>
        <label className="text-[11px] text-slate-500">
          Metri lin.
          <input name="loadingMeters" type="number" min={0} step="0.1" defaultValue={values.loadingMeters ?? ""} className="field-input py-1 text-xs" />
        </label>
        <label className="text-[11px] text-slate-500">
          Colli
          <input name="colli" type="number" min={0} defaultValue={values.colli ?? ""} className="field-input py-1 text-xs" />
        </label>
        <label className="text-[11px] text-slate-500">
          Peso (kg)
          <input name="weightKg" type="number" min={0} step="0.1" defaultValue={values.weightKg ?? ""} className="field-input py-1 text-xs" />
        </label>
        <label className="text-[11px] text-slate-500">
          Volume (m³)
          <input name="volumeM3" type="number" min={0} step="0.1" defaultValue={values.volumeM3 ?? ""} className="field-input py-1 text-xs" />
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="submit" className="btn-primary px-2 py-1 text-xs">Salva</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-2 py-1 text-xs">Annulla</button>
      </div>
    </form>
  );
}
