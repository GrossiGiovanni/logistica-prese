"use client";

// Riga carico con modifica inline + form di inserimento.

import { useState } from "react";
import { upsertCarico, deleteCarico } from "./actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

export type Carico = {
  id: string;
  dateInput: string;
  dayLabel: string;
  carrier: string;
  plate: string | null;
  destination: string | null;
  reference: string | null;
  pallets: number | null;
  colli: number | null;
  weightKg: number | null;
  volumeM3: number | null;
  notes: string | null;
};

function Fields({ c, carriers }: { c?: Carico; carriers: string[] }) {
  return (
    <>
      <div>
        <label className="field-label">Data *</label>
        <input type="date" name="loadDate" defaultValue={c?.dateInput ?? ""} required className="field-input w-auto" />
      </div>
      <div>
        <label className="field-label">Vettore *</label>
        <input
          name="carrier"
          list="carichi-vettori"
          defaultValue={c?.carrier ?? ""}
          required
          placeholder="Nome vettore"
          className="field-input w-44"
        />
        <datalist id="carichi-vettori">
          {carriers.map((v) => <option key={v} value={v} />)}
        </datalist>
      </div>
      <div>
        <label className="field-label">Targa</label>
        <input name="plate" defaultValue={c?.plate ?? ""} className="field-input w-28" />
      </div>
      <div>
        <label className="field-label">Destinazione</label>
        <input name="destination" defaultValue={c?.destination ?? ""} className="field-input w-40" />
      </div>
      <div>
        <label className="field-label">Riferimento</label>
        <input name="reference" defaultValue={c?.reference ?? ""} placeholder="DDT / ordine" className="field-input w-32" />
      </div>
      <div>
        <label className="field-label">Pallet</label>
        <input name="pallets" type="number" min={0} step="1" defaultValue={c?.pallets ?? ""} className="field-input w-20" />
      </div>
      <div>
        <label className="field-label">Colli</label>
        <input name="colli" type="number" min={0} step="1" defaultValue={c?.colli ?? ""} className="field-input w-20" />
      </div>
      <div>
        <label className="field-label">Peso kg</label>
        <input name="weightKg" type="number" min={0} step="0.1" defaultValue={c?.weightKg ?? ""} className="field-input w-24" />
      </div>
      <div>
        <label className="field-label">Volume m³</label>
        <input name="volumeM3" type="number" min={0} step="0.1" defaultValue={c?.volumeM3 ?? ""} className="field-input w-24" />
      </div>
      <div className="grow">
        <label className="field-label">Note di carico</label>
        <input name="notes" defaultValue={c?.notes ?? ""} placeholder="Indicazioni per il magazzino" className="field-input" />
      </div>
    </>
  );
}

/** Form di inserimento nuovo carico. */
export function NewCaricoForm({ carriers, back }: { carriers: string[]; back: string }) {
  return (
    <form action={upsertCarico} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="back" value={back} />
      <Fields carriers={carriers} />
      <button type="submit" className="btn-primary">Registra</button>
    </form>
  );
}

export function CaricoRow({ c, carriers, back }: { c: Carico; carriers: string[]; back: string }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-brand-50/40">
        <td colSpan={11} className="px-2 py-2">
          <form action={upsertCarico} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="back" value={back} />
            <Fields c={c} carriers={carriers} />
            <button type="submit" className="btn-primary">Salva</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Annulla</button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="whitespace-nowrap px-3 py-2">{c.dayLabel}</td>
      <td className="px-3 py-2 font-medium text-slate-800">{c.carrier}</td>
      <td className="px-3 py-2 font-mono">{c.plate ?? "—"}</td>
      <td className="px-3 py-2">{c.destination ?? "—"}</td>
      <td className="px-3 py-2">{c.reference ?? "—"}</td>
      <td className="px-3 py-2">{c.pallets ?? "—"}</td>
      <td className="px-3 py-2">{c.colli ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2">{c.weightKg != null ? `${c.weightKg} kg` : "—"}</td>
      <td className="whitespace-nowrap px-3 py-2">{c.volumeM3 != null ? `${c.volumeM3} m³` : "—"}</td>
      <td className="px-3 py-2 text-slate-500">{c.notes ?? "—"}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(true)} className="btn-secondary px-2 py-1">Modifica</button>
          <form action={deleteCarico}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="back" value={back} />
            <ConfirmButton variant="danger" className="px-2 py-1" confirm="Eliminare questo carico?">Elimina</ConfirmButton>
          </form>
        </div>
      </td>
    </tr>
  );
}
