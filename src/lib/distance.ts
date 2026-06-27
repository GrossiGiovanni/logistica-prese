// Calcolo dei KM di un giro su strada reale tramite Google Directions API.
// Il giro parte e termina sempre dal magazzino:
//   magazzino -> 1ª presa -> ... -> ultima presa -> magazzino
// seguendo l'ordine delle fermate (nessuna ottimizzazione: l'ordine è deciso
// dall'operatore). Richiede GOOGLE_MAPS_API_KEY (Directions API abilitata).

// Indirizzo del magazzino (partenza/arrivo di ogni giro). Modificabile qui.
export const WAREHOUSE_ADDRESS = "Via Ticino 33, 20098 San Giuliano Milanese MI, Italia";

type AddressParts = {
  street: string;
  city: string;
  province: string;
  postalCode?: string | null;
  country?: string | null;
};

/** Compone una stringa indirizzo per la geocodifica interna di Directions. */
export function addressToQuery(a: AddressParts): string {
  return [a.street, a.postalCode, a.city, a.province, a.country ?? "IT"]
    .filter((p) => p != null && String(p).trim().length > 0)
    .join(", ");
}

export type RouteKmResult =
  | { km: number; reason: null }
  | { km: null; reason: "no_key" | "no_stops" | "api_error" };

/**
 * Calcola i km totali del percorso magazzino → fermate (in ordine) → magazzino.
 * Best-effort: non lancia mai; in caso di errore/chiave assente restituisce km=null
 * con il motivo, così l'operazione chiamante (assegna/rimuovi/riordina) non fallisce.
 */
export async function computeRouteKm(stopAddresses: string[]): Promise<RouteKmResult> {
  if (stopAddresses.length === 0) return { km: null, reason: "no_stops" };

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { km: null, reason: "no_key" };

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", WAREHOUSE_ADDRESS);
  url.searchParams.set("destination", WAREHOUSE_ADDRESS);
  url.searchParams.set("waypoints", stopAddresses.join("|"));
  url.searchParams.set("mode", "driving");
  url.searchParams.set("region", "it");
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[distance] HTTP ${res.status}`);
      return { km: null, reason: "api_error" };
    }
    const data = (await res.json()) as {
      status: string;
      routes?: { legs?: { distance?: { value: number } }[] }[];
      error_message?: string;
    };
    if (data.status !== "OK" || !data.routes?.length) {
      console.warn(`[distance] status=${data.status} ${data.error_message ?? ""}`);
      return { km: null, reason: "api_error" };
    }
    const meters = (data.routes[0].legs ?? []).reduce(
      (sum, leg) => sum + (leg.distance?.value ?? 0),
      0,
    );
    return { km: Math.round(meters / 100) / 10, reason: null }; // km con 1 decimale
  } catch (err) {
    console.warn("[distance] errore di rete:", err);
    return { km: null, reason: "api_error" };
  }
}
