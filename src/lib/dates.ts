// Utility per la gestione delle date operative.
// Le date di presa/giro sono memorizzate come @db.Date (solo giorno, no orario).
// Lavoriamo sempre a mezzanotte UTC per evitare slittamenti di fuso.

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

/** Data di oggi (mezzanotte UTC) come stringa "YYYY-MM-DD". */
export function todayInputValue(): string {
  return toDateInputValue(new Date());
}

/** Data di domani come stringa "YYYY-MM-DD" — default operativo. */
export function tomorrowInputValue(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return toDateInputValue(d);
}

/** Data di ieri come stringa "YYYY-MM-DD". */
export function yesterdayInputValue(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
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

/** True se la stringa è una data valida nel formato "YYYY-MM-DD". */
export function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateOnly(value).getTime());
}
