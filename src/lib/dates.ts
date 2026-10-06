// Utility per la gestione delle date operative.
// Le date di presa/giro sono memorizzate come @db.Date (solo giorno, no orario).
// Lavoriamo sempre a mezzanotte UTC per evitare slittamenti di fuso; "oggi" è
// però calcolato sul calendario italiano (Europe/Rome).

export const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

const WEEKDAY_LABELS_IT: Record<WeekdayKey, string> = {
  monday: "Lunedì",
  tuesday: "Martedì",
  wednesday: "Mercoledì",
  thursday: "Giovedì",
  friday: "Venerdì",
  saturday: "Sabato",
  sunday: "Domenica",
};

/** Converte una stringa "YYYY-MM-DD" in Date a mezzanotte UTC. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Converte una Date in stringa "YYYY-MM-DD" (UTC). */
export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// "Oggi" operativo è sempre il giorno di calendario in Italia, indipendentemente
// dal fuso del server (Vercel gira in UTC: tra le 00:00 e le 02:00 italiane la
// data UTC è ancora quella di ieri).
export const APP_TIME_ZONE = "Europe/Rome";

const romeDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data di oggi a Roma come stringa "YYYY-MM-DD". */
export function todayInputValue(now: Date = new Date()): string {
  return romeDateFormatter.format(now); // en-CA => YYYY-MM-DD
}

/** Data di domani (a Roma) come stringa "YYYY-MM-DD" — default operativo. */
export function tomorrowInputValue(now: Date = new Date()): string {
  return addDaysInput(todayInputValue(now), 1);
}

/** Data di ieri (a Roma) come stringa "YYYY-MM-DD". */
export function yesterdayInputValue(now: Date = new Date()): string {
  return addDaysInput(todayInputValue(now), -1);
}

/** Aggiunge (o sottrae) giorni a una data "YYYY-MM-DD". */
export function addDaysInput(value: string, days: number): string {
  const d = parseDateOnly(value);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateInputValue(d);
}

/** Restituisce la chiave giorno della settimana (es. "monday") per una Date. */
export function weekdayKey(date: Date): WeekdayKey {
  return WEEKDAY_KEYS[date.getUTCDay()];
}

/** Etichetta italiana del giorno della settimana. */
export function weekdayLabelIt(date: Date): string {
  return WEEKDAY_LABELS_IT[weekdayKey(date)];
}

/** Formatta una data in italiano, es. "ven 20/06/2026". */
export function formatDateIt(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const wd = WEEKDAY_LABELS_IT[weekdayKey(date)].slice(0, 3).toLowerCase();
  return `${wd} ${day}/${month}/${year}`;
}

/** True se la stringa è una data esistente nel formato "YYYY-MM-DD" (no 31/02). */
export function isValidDateInput(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseDateOnly(value);
  return !Number.isNaN(d.getTime()) && toDateInputValue(d) === value;
}

/** Primo valore che sia una data valida, altrimenti il fallback. */
export function safeDateInput(candidates: (string | null | undefined)[], fallback: string): string {
  return candidates.find((c): c is string => isValidDateInput(c)) ?? fallback;
}

/** True se la stringa è un mese valido nel formato "YYYY-MM". */
export function isValidMonthInput(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return m != null && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** Normalizza un input "YYYY-MM": se non valido, mese corrente (a Roma). */
export function normalizeMonth(month?: string | null, now: Date = new Date()): string {
  return isValidMonthInput(month) ? (month as string) : todayInputValue(now).slice(0, 7);
}
