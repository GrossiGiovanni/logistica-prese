"use client";

// Riga registrazione "Autisti Eurosarda" con modifica inline.

import { useState } from "react";
import { updateTrailerLog, deleteTrailerLog } from "./actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

export function TrailerLogRow({
  log,
  drivers,
  back,
  dateInput,
}: {
  log: { id: string; logDate: string; driverName: string; driverId: string; trailerPlate: string; service: string; dayLabel: string };
  drivers: { id: string; name: string }[];
  back: string;
  dateInput: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-brand-50/40">
        <td colSpan={5} className="px-2 py-2">
          <form action={updateTrailerLog} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={log.id} />
            <input type="hidden" name="back" value={back} />
            <div>
              <label className="field-label">Giorno</label>
              <input type="date" name="logDate" defaultValue={dateInput} required className="field-input w-auto" />
            </div>
            <div>
              <label className="field-label">Autista</label>
              <select name="driverId" defaultValue={log.driverId} required className="field-input w-auto">
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Targa</label>
              <input name="trailerPlate" defaultValue={log.trailerPlate} required className="field-input w-40" />
            </div>
            <div className="grow">
              <label className="field-label">Servizio</label>
              <input name="service" defaultValue={log.service} required className="field-input" />
            </div>
            <button type="submit" className="btn-primary">Salva</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Annulla</button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2 whitespace-nowrap">{log.dayLabel}</td>
      <td className="px-3 py-2 font-medium text-slate-800">{log.driverName}</td>
      <td className="px-3 py-2 font-mono">{log.trailerPlate}</td>
      <td className="px-3 py-2">{log.service}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(true)} className="btn-secondary px-2 py-1">Modifica</button>
          <form action={deleteTrailerLog}>
            <input type="hidden" name="id" value={log.id} />
            <input type="hidden" name="back" value={back} />
            <ConfirmButton variant="danger" className="px-2 py-1" confirm="Eliminare questa registrazione?">
              Elimina
            </ConfirmButton>
          </form>
        </div>
      </td>
    </tr>
  );
}
