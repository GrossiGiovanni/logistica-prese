"use client";

// Riga trazionista con modifica inline + form di inserimento.

import { useState } from "react";
import { upsertTrazionista, deleteTrazionista } from "./actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Badge } from "@/components/badges/Badge";

export type Trazionista = {
  id: string;
  name: string;
  defaultCost: number | null;
  notes: string | null;
  active: boolean;
  carichiCount: number;
};

function Fields({ t }: { t?: Trazionista }) {
  return (
    <>
      <div>
        <label className="field-label">Nome / Vettore *</label>
        <input name="name" defaultValue={t?.name ?? ""} required placeholder="Es. ADRAGNA" className="field-input w-56" />
      </div>
      <div>
        <label className="field-label">Nolo predefinito €</label>
        <input
          name="defaultCost"
          type="number"
          min={0}
          step="0.01"
          defaultValue={t?.defaultCost ?? ""}
          placeholder="es. 850"
          className="field-input w-32"
        />
      </div>
      <div className="grow">
        <label className="field-label">Note</label>
        <input name="notes" defaultValue={t?.notes ?? ""} className="field-input" />
      </div>
      <label className="flex items-center gap-2 pb-2">
        <input type="checkbox" name="active" defaultChecked={t ? t.active : true} className="h-4 w-4" />
        <span className="text-sm text-slate-600">Attivo</span>
      </label>
    </>
  );
}

export function NewTrazionistaForm() {
  return (
    <form action={upsertTrazionista} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
      <Fields />
      <button type="submit" className="btn-primary">Aggiungi</button>
    </form>
  );
}

export function TrazionistaRow({ t }: { t: Trazionista }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-brand-50/40">
        <td colSpan={5} className="px-2 py-2">
          <form action={upsertTrazionista} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={t.id} />
            <Fields t={t} />
            <button type="submit" className="btn-primary">Salva</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Annulla</button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2">
        <span className="font-medium text-slate-800">{t.name}</span>
        {!t.active ? <span className="ml-2"><Badge tone="slate">Non attivo</Badge></span> : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {t.defaultCost != null ? `${t.defaultCost} €` : "—"}
      </td>
      <td className="px-3 py-2 text-slate-500">{t.notes ?? "—"}</td>
      <td className="px-3 py-2 text-slate-500">{t.carichiCount}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(true)} className="btn-secondary px-2 py-1">Modifica</button>
          <form action={deleteTrazionista}>
            <input type="hidden" name="id" value={t.id} />
            <ConfirmButton
              variant="danger"
              className="px-2 py-1"
              confirm={`Eliminare il trazionista "${t.name}"? I carichi già registrati restano, perderanno solo il collegamento.`}
            >
              Elimina
            </ConfirmButton>
          </form>
        </div>
      </td>
    </tr>
  );
}
