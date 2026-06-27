import {
  pickupStatusLabels,
  pickupSourceLabels,
  timeWindowLabels,
  toOptions,
} from "@/lib/labels";
import { applyPreseFilters, clearPreseFilters } from "./filter-actions";

/** Barra filtri prese — i filtri vengono salvati in un cookie e persistono tra le pagine. */
export function PickupFiltersBar({
  current,
}: {
  current: {
    date?: string;
    status?: string;
    sourceType?: string;
    timeWindow?: string;
    search?: string;
  };
}) {
  return (
    <form action={applyPreseFilters} className="card mb-4 flex flex-wrap items-end gap-3 p-3">
      <div>
        <label className="field-label">Data</label>
        <input type="date" name="date" defaultValue={current.date ?? ""} className="field-input w-auto" />
      </div>
      <div>
        <label className="field-label">Stato</label>
        <select name="status" defaultValue={current.status ?? ""} className="field-input w-auto">
          <option value="">Tutti</option>
          {toOptions(pickupStatusLabels).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label">Origine</label>
        <select name="sourceType" defaultValue={current.sourceType ?? ""} className="field-input w-auto">
          <option value="">Tutte</option>
          {toOptions(pickupSourceLabels).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label">Fascia</label>
        <select name="timeWindow" defaultValue={current.timeWindow ?? ""} className="field-input w-auto">
          <option value="">Tutte</option>
          {toOptions(timeWindowLabels).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="grow">
        <label className="field-label">Cerca (cliente / località / n. presa)</label>
        <input type="text" name="search" defaultValue={current.search ?? ""} placeholder="Es. Magis, Milano, 9004641…" className="field-input" />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Filtra</button>
        <button type="submit" formAction={clearPreseFilters} className="btn-secondary">Azzera</button>
      </div>
    </form>
  );
}
