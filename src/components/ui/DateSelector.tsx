"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Selettore data operativa. Aggiorna il query param `date` mantenendo
 * gli altri parametri esistenti, così la pagina (server component) ricarica.
 */
export function DateSelector({
  value,
  paramName = "date",
  label = "Data operativa",
}: {
  value: string;
  paramName?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(paramName, next);
    else params.delete(paramName);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-600">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input w-auto"
      />
    </label>
  );
}
