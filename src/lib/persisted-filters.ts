// Persistenza dei filtri tra le pagine, tramite cookie.
// - op_date: data operativa condivisa (dashboard, pianificazione, giri, prese)
// - f_prese / f_pian: set di filtri della rispettiva schermata
// I cookie restano finché l'utente non li azzera manualmente (vedi filter-actions).

import { cookies } from "next/headers";

export const OP_DATE_COOKIE = "op_date";
export const PRESE_FILTERS_COOKIE = "f_prese";
export const PIAN_FILTERS_COOKIE = "f_pian";

/** Data operativa memorizzata (o undefined). */
export async function getOpDate(): Promise<string | undefined> {
  return (await cookies()).get(OP_DATE_COOKIE)?.value || undefined;
}

export type PreseFilterState = {
  status?: string;
  sourceType?: string;
  timeWindow?: string;
  search?: string;
  unassigned?: string; // "1" = solo prese non assegnate ad alcun giro
};

export async function getPreseFilters(): Promise<PreseFilterState> {
  const raw = (await cookies()).get(PRESE_FILTERS_COOKIE)?.value;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PreseFilterState;
  } catch {
    return {};
  }
}

export type PianFilterState = { q?: string; tw?: string; prio?: string };

export async function getPianFilters(): Promise<PianFilterState> {
  const raw = (await cookies()).get(PIAN_FILTERS_COOKIE)?.value;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PianFilterState;
  } catch {
    return {};
  }
}
