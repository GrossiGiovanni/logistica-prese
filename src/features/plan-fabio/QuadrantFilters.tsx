"use client";

// Barra filtri di un singolo quadrante. Aggiorna SOLO le chiavi "qN_*" del
// quadrante corrente nell'URL, lasciando intatte quelle degli altri tre
// quadranti: così modificare un quadrante non influenza gli altri.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { routeShiftLabels, pickupStatusLabels } from "@/lib/labels";

type Option = { id: string; name?: string; label?: string };

export type QuadrantCurrent = {
  branchId: string;
  date: string;
  customerId: string;
  driverId: string;
  vehicleId: string;
  shift: string;
  status: string;
  unassignedOnly: boolean;
  routeId: string;
};

export function QuadrantFilters({
  q,
  branches,
  customers,
  drivers,
  vehicles,
  routes,
  current,
}: {
  q: number;
  branches: { id: string; name: string; code: string }[];
  customers: Option[];
  drivers: Option[];
  vehicles: Option[];
  routes: Option[];
  current: QuadrantCurrent;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(Array.from(sp.entries()));
    const k = `q${q}_${key}`;
    if (value) params.set(k, value);
    else params.delete(k);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const sel = "field-input w-full py-1 text-xs";

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase text-slate-400">Data</span>
        <input
          type="date"
          defaultValue={current.date}
          onChange={(e) => update("date", e.target.value)}
          className={sel}
        />
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase text-slate-400">Filiale</span>
        <select value={current.branchId} onChange={(e) => update("branch", e.target.value)} className={sel}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase text-slate-400">Fascia</span>
        <select value={current.shift} onChange={(e) => update("shift", e.target.value)} className={sel}>
          <option value="">Tutte</option>
          {(Object.keys(routeShiftLabels) as (keyof typeof routeShiftLabels)[]).map((s) => (
            <option key={s} value={s}>{routeShiftLabels[s]}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase text-slate-400">Cliente</span>
        <select value={current.customerId} onChange={(e) => update("cust", e.target.value)} className={sel}>
          <option value="">Tutti</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase text-slate-400">Autista</span>
        <select value={current.driverId} onChange={(e) => update("driver", e.target.value)} className={sel}>
          <option value="">Tutti</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase text-slate-400">Mezzo</span>
        <select value={current.vehicleId} onChange={(e) => update("vehicle", e.target.value)} className={sel}>
          <option value="">Tutti</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase text-slate-400">Stato presa</span>
        <select value={current.status} onChange={(e) => update("status", e.target.value)} className={sel}>
          <option value="">Tutti</option>
          {(["READY", "DRAFT", "PLANNED"] as const).map((s) => (
            <option key={s} value={s}>{pickupStatusLabels[s]}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase text-slate-400">Giro specifico</span>
        <select value={current.routeId} onChange={(e) => update("route", e.target.value)} className={sel}>
          <option value="">Tutti</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 self-end pb-1">
        <input
          type="checkbox"
          checked={current.unassignedOnly}
          onChange={(e) => update("unassigned", e.target.checked ? "1" : "")}
          className="h-3.5 w-3.5"
        />
        <span className="text-[11px] text-slate-600">Solo da assegnare</span>
      </label>
    </div>
  );
}
