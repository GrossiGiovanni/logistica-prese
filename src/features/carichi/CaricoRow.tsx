"use client";

// Riga carico con modifica inline + form di inserimento.
// Scegliendo il vettore dall'anagrafica trazionisti, il nolo viene precompilato
// con il costo predefinito, restando comunque modificabile a mano.
// Indicando un autista Eurosarda (o scegliendo un vettore Eurosarda) il carico
// diventa una trazione industriale: il suo nolo va nel Costo Industriale.

import { useState } from "react";
import { upsertCarico, deleteCarico } from "./actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Badge } from "@/components/badges/Badge";

export type TrazionistaOption = { id: string; name: string; defaultCost: number | null; isEurosarda: boolean };
export type DriverOption = { id: string; name: string };

export type Carico = {
  id: string;
  dateInput: string;
  dayLabel: string;
  carrier: string;
  trazionistaId: string | null;
  driverId: string | null;
  driverName: string | null;
  /** Trazione industriale (calcolata lato server con isIndustrialCarico). */
  industrial: boolean;
  nolo: number | null;
  notes: string | null;
};

const LEGACY = "__legacy__";

function Fields({
  c,
  trazionisti,
  drivers,
}: {
  c?: Carico;
  trazionisti: TrazionistaOption[];
  drivers: DriverOption[];
}) {
  // Vettore già in anagrafica? altrimenti si conserva il nome storico.
  const matched =
    c?.trazionistaId ?? trazionisti.find((t) => t.name === c?.carrier)?.id ?? "";
  const [sel, setSel] = useState(matched || (c?.carrier ? LEGACY : ""));
  const [carrier, setCarrier] = useState(c?.carrier ?? "");
  const [nolo, setNolo] = useState(c?.nolo != null ? String(c.nolo) : "");
  const [driverId, setDriverId] = useState(c?.driverId ?? "");

  function pickTrazionista(t: TrazionistaOption) {
    setSel(t.id);
    setCarrier(t.name);
    // Precompila il nolo dal costo predefinito (resta modificabile).
    if (t.defaultCost != null) setNolo(String(t.defaultCost));
  }

  function onSelect(value: string) {
    setSel(value);
    if (value === LEGACY || value === "") return;
    const t = trazionisti.find((x) => x.id === value);
    if (t) pickTrazionista(t);
  }

  function onDriver(value: string) {
    setDriverId(value);
    // Autista Eurosarda senza vettore: propone il vettore Eurosarda.
    if (value && !sel) {
      const eurosarda = trazionisti.find((t) => t.isEurosarda);
      if (eurosarda) pickTrazionista(eurosarda);
    }
  }

  // Anteprima della classificazione (la regola vera è lato server).
  const industrial = Boolean(driverId) || Boolean(trazionisti.find((t) => t.id === sel)?.isEurosarda);
  // L'autista già collegato resta selezionabile anche se non più Eurosarda/attivo.
  const driverOptions =
    c?.driverId && !drivers.some((d) => d.id === c.driverId)
      ? [...drivers, { id: c.driverId, name: c.driverName ?? "Autista" }]
      : drivers;

  return (
    <>
      <div>
        <label className="field-label">Data *</label>
        <input type="date" name="loadDate" defaultValue={c?.dateInput ?? ""} required className="field-input w-auto" />
      </div>
      <div>
        <label className="field-label">Vettore *</label>
        <select value={sel} onChange={(e) => onSelect(e.target.value)} required className="field-input w-48">
          <option value="" disabled>Seleziona…</option>
          {c?.carrier && !matched ? <option value={LEGACY}>{c.carrier}</option> : null}
          {trazionisti.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input type="hidden" name="carrier" value={carrier} />
        <input type="hidden" name="trazionistaId" value={sel === LEGACY ? "" : sel} />
      </div>
      <div>
        <label className="field-label">Autista Eurosarda</label>
        <select name="driverId" value={driverId} onChange={(e) => onDriver(e.target.value)} className="field-input w-44">
          <option value="">— nessuno (vettore esterno)</option>
          {driverOptions.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div className="grow">
        <label className="field-label">Note di carico</label>
        <input name="notes" defaultValue={c?.notes ?? ""} placeholder="Indicazioni per il magazzino" className="field-input" />
      </div>
      <div>
        <label className="field-label">Nolo €</label>
        <input
          name="nolo"
          type="number"
          min={0}
          step="0.01"
          value={nolo}
          onChange={(e) => setNolo(e.target.value)}
          placeholder="da anagrafica"
          className="field-input w-28"
        />
      </div>
      <div className="pb-2 text-xs">
        {industrial ? <Badge tone="blue">Trazione industriale</Badge> : <Badge tone="slate">Nolo esterno</Badge>}
      </div>
    </>
  );
}

/** Form di inserimento nuovo carico. */
export function NewCaricoForm({
  trazionisti,
  drivers,
  back,
}: {
  trazionisti: TrazionistaOption[];
  drivers: DriverOption[];
  back: string;
}) {
  return (
    <form action={upsertCarico} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="back" value={back} />
      <Fields trazionisti={trazionisti} drivers={drivers} />
      <button type="submit" className="btn-primary">Registra</button>
    </form>
  );
}

export function CaricoRow({
  c,
  trazionisti,
  drivers,
  back,
}: {
  c: Carico;
  trazionisti: TrazionistaOption[];
  drivers: DriverOption[];
  back: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-brand-50/40">
        <td colSpan={6} className="px-2 py-2">
          <form action={upsertCarico} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="back" value={back} />
            <Fields c={c} trazionisti={trazionisti} drivers={drivers} />
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
      <td className="px-3 py-2">
        <div className="font-medium text-slate-800">{c.carrier}</div>
        {c.driverName ? <div className="text-xs text-slate-500">Autista: {c.driverName}</div> : null}
      </td>
      <td className="px-3 py-2">
        {c.industrial ? <Badge tone="blue">Industriale</Badge> : <Badge tone="slate">Nolo esterno</Badge>}
      </td>
      <td className="px-3 py-2 text-slate-500">{c.notes ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2">{c.nolo != null ? `${c.nolo} €` : "—"}</td>
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
