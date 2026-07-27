"use client";

// Riga trazione con modifica inline.

import { useState } from "react";
import { upsertTraction, deleteTraction } from "./actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

type Driver = { id: string; name: string };
type Traction = {
  id: string;
  dateInput: string;
  dayLabel: string;
  plate: string | null;
  driverId: string | null;
  driverName: string | null;
  origin: string;
  destination: string;
  km: number | null;
  cost: number | null;
};

function Fields({ t, drivers }: { t?: Traction; drivers: Driver[] }) {
  return (
    <>
      <div>
        <label className="field-label">Data *</label>
        <input type="date" name="tractionDate" defaultValue={t?.dateInput ?? ""} required className="field-input w-auto" />
      </div>
      <div>
        <label className="field-label">Targa</label>
        <input name="plate" defaultValue={t?.plate ?? ""} className="field-input w-32" />
      </div>
      <div>
        <label className="field-label">Autista</label>
        <select name="driverId" defaultValue={t?.driverId ?? ""} className="field-input w-auto">
          <option value="">—</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label">Partenza *</label>
        <input name="origin" defaultValue={t?.origin ?? ""} required placeholder="Città o indirizzo" className="field-input w-44" />
      </div>
      <div>
        <label className="field-label">Arrivo *</label>
        <input name="destination" defaultValue={t?.destination ?? ""} required placeholder="Città o indirizzo" className="field-input w-44" />
      </div>
      <div>
        <label className="field-label">Km</label>
        <input name="km" type="number" min={0} step="0.1" defaultValue={t?.km ?? ""} placeholder="auto" className="field-input w-24" />
      </div>
      <div>
        <label className="field-label">Costo €</label>
        <input name="cost" type="number" min={0} step="0.01" defaultValue={t?.cost ?? ""} className="field-input w-24" />
      </div>
    </>
  );
}

/** Form di inserimento nuova trazione. */
export function NewTractionForm({ drivers, back }: { drivers: Driver[]; back: string }) {
  return (
    <form action={upsertTraction} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="back" value={back} />
      <Fields drivers={drivers} />
      <button type="submit" className="btn-primary">Registra</button>
      <span className="text-xs text-slate-400">Km vuoto = calcolato dalla mappa</span>
    </form>
  );
}

export function TractionRow({ t, drivers, back }: { t: Traction; drivers: Driver[]; back: string }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-brand-50/40">
        <td colSpan={8} className="px-2 py-2">
          <form action={upsertTraction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="back" value={back} />
            <Fields t={t} drivers={drivers} />
            <button type="submit" className="btn-primary">Salva</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Annulla</button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2 whitespace-nowrap">{t.dayLabel}</td>
      <td className="px-3 py-2 font-mono">{t.plate ?? "—"}</td>
      <td className="px-3 py-2">{t.driverName ?? "—"}</td>
      <td className="px-3 py-2">{t.origin}</td>
      <td className="px-3 py-2">{t.destination}</td>
      <td className="px-3 py-2 whitespace-nowrap">{t.km != null ? `${t.km} km` : "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">{t.cost != null ? `${t.cost} €` : "—"}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(true)} className="btn-secondary px-2 py-1">Modifica</button>
          <form action={deleteTraction}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="back" value={back} />
            <ConfirmButton variant="danger" className="px-2 py-1" confirm="Eliminare questa trazione?">Elimina</ConfirmButton>
          </form>
        </div>
      </td>
    </tr>
  );
}
