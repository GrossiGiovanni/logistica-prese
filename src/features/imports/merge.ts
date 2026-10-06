// Regole pure di fusione tra una riga AS400 e una presa già presente.
// (Estratte da actions.ts per poterle collaudare senza database.)

import type { ParsedRow } from "./parse";
import { normalizePickupNumber } from "./parse";
import { isValidDateInput, parseDateOnly } from "@/lib/dates";

/**
 * Identità COMPLETA di una presa: anno + numero.
 *
 * AS400 esporta la stessa presa in due formati: lungo "2026 13 9005032"
 * (anno, serie, numero) e corto "9005032". Dentro una filiale la serie è
 * costante (e le filiali sono già separate), quindi l'identità è anno + numero:
 *  - l'anno viene dal formato lungo se presente, altrimenti dalla data della presa;
 *  - così i due formati della stessa presa coincidono, mentre lo stesso numero in
 *    anni diversi (al cambio d'anno) resta una presa DIVERSA.
 * Restituisce null se l'anno non è ricavabile (formato corto senza data).
 */
export function pickupIdentityKey(numero: string | null | undefined, date?: string | null): string | null {
  const norm = normalizePickupNumber(numero);
  if (!norm) return null;
  const long = norm.match(/^(\d{4}) \d+ (\d+)$/);
  if (long) return `${long[1]}-${long[2]}`;
  const parts = norm.split(" ");
  const num = parts[parts.length - 1];
  const year = date && /^\d{4}-/.test(date) ? date.slice(0, 4) : null;
  return year ? `${year}-${num}` : null;
}

export type ExistingPickup = {
  pallets: number | null;
  loadingMeters: number | null;
  rawNotes: string | null;
  routeStopsCount: number;
};

/** Solo i valori presenti: un dato vuoto in arrivo non cancella mai un dato esistente. */
function present<K extends string>(key: K, value: unknown): Partial<Record<K, unknown>> {
  return value == null || value === "" ? {} : ({ [key]: value } as Record<K, unknown>);
}

/**
 * Dati da aggiornare su una presa esistente.
 *
 * Regole sempre valide:
 *  - mai sovrascrivere un dato esistente con un valore vuoto;
 *  - mai modificare la fascia (timeWindow/orario): può essere stata scelta a mano;
 *  - la richiesta motrice può solo essere aggiunta, mai tolta;
 *  - lo stato non si scrive: è calcolato (giro / dati di carico / annullata).
 *
 * Presa già in un giro (o import "aggiornamento"): solo il consuntivo
 * (peso, volume, colli) e il riempimento dei dati di carico mancanti.
 */
export function buildExistingPickupUpdate(
  target: ExistingPickup,
  r: ParsedRow,
  opts: { aggiornamento: boolean },
): Record<string, unknown> {
  const soloConsuntivo = opts.aggiornamento || target.routeStopsCount > 0;
  if (soloConsuntivo) {
    return {
      ...present("weightKg", r.weightKg),
      ...(r.volumeM3 != null ? { volumeM3: r.volumeM3, taxableVolumeM3: r.volumeM3 } : {}),
      ...present("colli", r.colli),
      ...(target.pallets == null ? present("pallets", r.pallets) : {}),
      ...(target.loadingMeters == null ? present("loadingMeters", r.loadingMeters) : {}),
      ...(!target.rawNotes ? present("rawNotes", r.rawNotes) : {}),
    };
  }
  return {
    ...present("pallets", r.pallets),
    ...present("colli", r.colli),
    ...present("loadingMeters", r.loadingMeters),
    ...present("weightKg", r.weightKg),
    ...present("volumeM3", r.volumeM3),
    ...present("rawNotes", r.rawNotes),
    ...(r.requiresMotrice ? { requiresMotrice: true } : {}),
    // La data si sposta solo se la presa non è ancora in un giro e se è valida.
    ...(isValidDateInput(r.date) ? { pickupDate: parseDateOnly(r.date) } : {}),
  };
}
