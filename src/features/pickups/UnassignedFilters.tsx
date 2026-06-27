import { timeWindowLabels, priorityLabels, toOptions } from "@/lib/labels";
import { applyPianFilters, clearPianFilters } from "./filter-actions";

/**
 * Barra filtri per le prese non assegnate in pianificazione.
 * I filtri (ricerca cliente/n. presa/località, fascia, priorità) persistono in
 * un cookie e restano tra le pagine; "Azzera" li rimuove (la data resta).
 */
export function UnassignedFilters({
  date,
  current,
}: {
  date: string;
  current: { q?: string; tw?: string; prio?: string };
}) {
  return (
    <form action={applyPianFilters} className="mb-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="date" value={date} />
      <div className="grow">
        <label className="field-label">Cerca</label>
        <input
          type="text"
          name="q"
          defaultValue={current.q ?? ""}
          placeholder="Cliente, n. presa, località…"
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label">Fascia</label>
        <select name="tw" defaultValue={current.tw ?? ""} className="field-input w-auto">
          <option value="">Tutte</option>
          {toOptions(timeWindowLabels).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label">Priorità</label>
        <select name="prio" defaultValue={current.prio ?? ""} className="field-input w-auto">
          <option value="">Tutte</option>
          {toOptions(priorityLabels).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-secondary">Filtra</button>
        <button type="submit" formAction={clearPianFilters} className="btn-secondary">Azzera</button>
      </div>
    </form>
  );
}
