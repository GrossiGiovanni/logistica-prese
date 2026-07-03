// Geocoding server-side tramite Google Geocoding API.
// Richiede GOOGLE_MAPS_API_KEY (chiave server, NON quella pubblica NEXT_PUBLIC_*).
// Usato in upsertAddress e nello script di geocoding massivo.

export type GeocodeResult = { lat: number; lng: number };

type AddressParts = {
  street: string;
  city: string;
  province: string;
  postalCode?: string | null;
  country?: string | null;
};

/**
 * Compone una query di indirizzo leggibile da Google. CAP, città e provincia
 * vengono tenuti insieme ("20098 San Giuliano Milanese MI") per ridurre il
 * rischio che località con nomi simili vengano confuse.
 */
export function formatAddressQuery(a: AddressParts): string {
  const locality = [a.postalCode, a.city, a.province]
    .filter((p) => p != null && String(p).trim().length > 0)
    .join(" ");
  return [a.street, locality, "Italia"]
    .filter((p) => p && String(p).trim().length > 0)
    .join(", ");
}

/**
 * Restituisce lat/lng per un indirizzo, o null se non geocodificabile
 * (chiave assente, nessun risultato, errore di rete). Non lancia: la
 * geocodifica è best-effort e non deve bloccare il salvataggio dell'indirizzo.
 */
export async function geocodeAddress(a: AddressParts): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.warn("[geocode] GOOGLE_MAPS_API_KEY non impostata: geocodifica saltata.");
    return null;
  }

  const query = formatAddressQuery(a);
  if (!query) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("region", "it");
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[geocode] HTTP ${res.status} per "${query}"`);
      return null;
    }
    const data = (await res.json()) as {
      status: string;
      results?: { geometry?: { location?: { lat: number; lng: number } } }[];
      error_message?: string;
    };

    if (data.status !== "OK" || !data.results?.length) {
      // Geocoding API non attivata sul progetto: ripiega sulla Directions API
      // (attiva), che geocodifica internamente origine/destinazione.
      if (data.status === "REQUEST_DENIED") {
        return geocodeViaDirections(query, key);
      }
      if (data.status !== "ZERO_RESULTS") {
        console.warn(`[geocode] status=${data.status} ${data.error_message ?? ""} per "${query}"`);
      }
      return null;
    }

    const loc = data.results[0].geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat, lng: loc.lng };
  } catch (err) {
    console.warn(`[geocode] errore di rete per "${query}":`, err);
    return null;
  }
}

/**
 * Fallback: ricava le coordinate da una richiesta Directions con origine =
 * destinazione = indirizzo (il leg riporta la posizione geocodificata).
 */
async function geocodeViaDirections(query: string, key: string): Promise<GeocodeResult | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", query);
    url.searchParams.set("destination", query);
    url.searchParams.set("region", "it");
    url.searchParams.set("key", key);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      routes?: { legs?: { start_location?: { lat: number; lng: number } }[] }[];
      error_message?: string;
    };
    const loc = data.routes?.[0]?.legs?.[0]?.start_location;
    if (data.status !== "OK" || !loc) {
      console.warn(`[geocode/directions] status=${data.status} ${data.error_message ?? ""} per "${query}"`);
      return null;
    }
    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}
