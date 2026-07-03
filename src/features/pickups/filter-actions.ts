"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  OP_DATE_COOKIE,
  PRESE_FILTERS_COOKIE,
  PIAN_FILTERS_COOKIE,
} from "@/lib/persisted-filters";

const ONE_YEAR = 60 * 60 * 24 * 365;

function str(formData: FormData, key: string): string | undefined {
  const v = (formData.get(key) as string | null)?.trim();
  return v ? v : undefined;
}

/** Applica i filtri prese: li salva nel cookie e ricarica /prese. */
export async function applyPreseFilters(formData: FormData): Promise<void> {
  const date = str(formData, "date");
  const state = {
    status: str(formData, "status"),
    sourceType: str(formData, "sourceType"),
    timeWindow: str(formData, "timeWindow"),
    search: str(formData, "search"),
    unassigned: str(formData, "unassigned"),
  };
  const c = await cookies();
  if (Object.values(state).some(Boolean)) {
    c.set(PRESE_FILTERS_COOKIE, JSON.stringify(state), { path: "/", maxAge: ONE_YEAR });
  } else {
    c.delete(PRESE_FILTERS_COOKIE);
  }
  if (date) c.set(OP_DATE_COOKIE, date, { path: "/", maxAge: ONE_YEAR });
  redirect(date ? `/prese?date=${date}` : "/prese");
}

/** Azzera i filtri prese (la data resta). */
export async function clearPreseFilters(): Promise<void> {
  (await cookies()).delete(PRESE_FILTERS_COOKIE);
  redirect("/prese");
}

/** Applica i filtri pianificazione: li salva nel cookie e ricarica. */
export async function applyPianFilters(formData: FormData): Promise<void> {
  const date = str(formData, "date");
  const state = {
    q: str(formData, "q"),
    tw: str(formData, "tw"),
    prio: str(formData, "prio"),
  };
  const c = await cookies();
  if (Object.values(state).some(Boolean)) {
    c.set(PIAN_FILTERS_COOKIE, JSON.stringify(state), { path: "/", maxAge: ONE_YEAR });
  } else {
    c.delete(PIAN_FILTERS_COOKIE);
  }
  if (date) c.set(OP_DATE_COOKIE, date, { path: "/", maxAge: ONE_YEAR });
  redirect(date ? `/pianificazione?date=${date}` : "/pianificazione");
}

/** Azzera i filtri pianificazione (la data resta). */
export async function clearPianFilters(formData: FormData): Promise<void> {
  const date = str(formData, "date");
  (await cookies()).delete(PIAN_FILTERS_COOKIE);
  redirect(date ? `/pianificazione?date=${date}` : "/pianificazione");
}
