"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/branch";
import { routeSchema, parseForm, type ActionResult } from "@/lib/validations";
import { computeRouteKm } from "@/lib/distance";
import { routeEditableData } from "./route-data";

function revalidateRoutes(routeId?: string) {
  revalidatePath("/giri");
  revalidatePath("/pianificazione");
  revalidatePath("/pianificazione-plus");
  revalidatePath("/dashboard");
  if (routeId) revalidatePath(`/giri/${routeId}`);
}

/**
 * Ricalcola e salva i km del giro (magazzino → fermate in ordine → magazzino)
 * tramite Google Directions. Best-effort: se la chiave manca o l'API fallisce,
 * non sovrascrive l'ultimo km valido e non interrompe l'operazione chiamante.
 */
export async function recalcRouteKm(routeId: string): Promise<void> {
  try {
    const addrSelect = {
      select: {
        street: true,
        city: true,
        province: true,
        postalCode: true,
        lat: true,
        lng: true,
      },
    } as const;
    const stops = await prisma.routeStop.findMany({
      where: { routeId },
      orderBy: { sequence: "asc" },
      select: {
        pickup: { select: { address: addrSelect } },
        reso: { select: { address: addrSelect } },
      },
    });
    // Waypoint = coordinate salvate (le stesse dei pin mappa), testo in riserva.
    // Include sia i ritiri sia i resi (entrambi sono tappe fisiche); salta le
    // fermate prive di indirizzo (es. reso senza indirizzo).
    const addresses = stops
      .map((s) => s.pickup?.address ?? s.reso?.address)
      .filter((a): a is NonNullable<typeof a> => a != null);
    const result = await computeRouteKm(addresses);
    if (result.km != null || result.reason === "no_stops") {
      await prisma.route.update({ where: { id: routeId }, data: { km: result.km } });
    }
  } catch (err) {
    console.warn("[recalcRouteKm] errore:", err);
  }
}

/**
 * Colloca una presa (o un reso) in un giro, oppure lo toglie da ogni giro
 * (routeId = null). Una presa sta in UN SOLO giro: se è già in un altro, viene
 * SPOSTATA. Tutto in transazione; restituisce i giri toccati (per i km).
 * Lo stato della presa non si scrive: "Pianificata" deriva dal giro stesso.
 */
async function placeStop(
  item: { pickupId: string } | { resoId: string },
  routeId: string | null,
): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.routeStop.findFirst({ where: item, select: { id: true, routeId: true } });
    if (current && current.routeId === routeId) return []; // già in quel giro

    const touched: string[] = [];
    if (current) {
      await tx.routeStop.delete({ where: { id: current.id } });
      touched.push(current.routeId);
    }
    if (routeId) {
      const last = await tx.routeStop.findFirst({
        where: { routeId },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
      await tx.routeStop.create({ data: { ...item, routeId, sequence: (last?.sequence ?? 0) + 1 } });
      touched.push(routeId);
    }
    return touched;
  });
}

async function recalcAll(routeIds: string[]): Promise<void> {
  for (const id of new Set(routeIds)) await recalcRouteKm(id);
}

/** Crea un nuovo giro (in bozza) e reindirizza al suo dettaglio. */
export async function createRoute(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseForm(routeSchema, formData);
  if (!parsed.success) return parsed.result;

  const branchId = await requireBranchId();
  // Nessuno stato dal form: un giro nuovo nasce in bozza (default del database).
  const route = await prisma.route.create({ data: { ...routeEditableData(parsed.data), branchId } });

  revalidateRoutes();
  redirect(`/giri/${route.id}`);
}

/**
 * Salvataggio automatico del giro.
 * Usato dal form mentre l'operatore compila: se cambia pagina, i dati inseriti
 * (autista, mezzo, fascia, orari, note) non vanno persi. NON tocca mai lo stato
 * del giro (si conferma solo col pulsante dedicato). Alla prima chiamata crea
 * la bozza e restituisce l'id, che il form riusa per i salvataggi successivi.
 */
export async function autosaveRouteDraft(
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const id = ((formData.get("id") as string) || "").trim();
  const parsed = parseForm(routeSchema, formData);
  if (!parsed.success) return { ok: false, error: "Dati non validi" };

  const data = routeEditableData(parsed.data);

  try {
    if (id) {
      await prisma.route.update({ where: { id }, data });
      revalidateRoutes(id);
      return { ok: true, id };
    }
    // Primo salvataggio: crea la bozza solo quando c'è già qualcosa di utile.
    if (!data.driverId && !data.vehicleId) return { ok: false };
    const route = await prisma.route.create({ data: { ...data, branchId: await requireBranchId() } });
    revalidateRoutes();
    return { ok: true, id: route.id };
  } catch {
    return { ok: false, error: "Salvataggio non riuscito" };
  }
}

/** Aggiorna autista/mezzo/fascia/orari/note del giro (mai lo stato). */
export async function updateRoute(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id") as string;
  if (!id) return { ok: false, error: "Giro non trovato." };

  const parsed = parseForm(routeSchema, formData);
  if (!parsed.success) return parsed.result;

  await prisma.route.update({ where: { id }, data: routeEditableData(parsed.data) });

  revalidateRoutes(id);
  return { ok: true };
}

/** Registra l'ultimo invio del giro su WhatsApp (storico). */
export async function markWhatsappSent(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;
  await prisma.route.update({ where: { id }, data: { lastWhatsappSentAt: new Date() } });
  revalidateRoutes(id);
}

/** Ricalcola manualmente i km del giro (bottone "Ricalcola KM"). */
export async function recalculateRouteKm(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;
  await recalcRouteKm(id);
  revalidateRoutes(id);
  redirect(`/giri/${id}`);
}

/** Cambia lo stato del giro (DRAFT/CONFIRMED): UNICO punto che scrive lo stato. */
export async function setRouteStatus(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const status = formData.get("status");
  if (!id || (status !== "DRAFT" && status !== "CONFIRMED")) return;
  await prisma.route.update({ where: { id }, data: { status } });
  revalidateRoutes(id);
  redirect(`/giri/${id}`);
}

/** Elimina un giro: le sue fermate spariscono e le prese tornano da assegnare. */
export async function deleteRoute(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/giri";
  if (!id) return;

  // La cascata rimuove le fermate: lo stato delle prese è calcolato, quindi
  // tornano automaticamente "Pronta"/"Da completare" senza altri aggiornamenti.
  await prisma.route.delete({ where: { id } });

  revalidateRoutes();
  redirect(redirectTo);
}

/** Assegna una presa a un giro (in coda). Se era in un altro giro, viene spostata. */
export async function assignPickupToRoute(formData: FormData): Promise<void> {
  const routeId = formData.get("routeId") as string;
  const pickupId = formData.get("pickupId") as string;
  const redirectTo = (formData.get("redirectTo") as string) || `/giri/${routeId}`;
  if (!routeId || !pickupId) return;

  await recalcAll(await placeStop({ pickupId }, routeId));

  revalidateRoutes(routeId);
  redirect(redirectTo);
}

/**
 * Imposta il giro di una presa in un colpo solo (per Pianificazione Plus):
 * routeId valorizzato → sposta/assegna la presa a quel giro;
 * routeId vuoto → la presa torna "da assegnare".
 */
export async function setPickupRoute(formData: FormData): Promise<void> {
  const pickupId = formData.get("pickupId") as string;
  const routeId = ((formData.get("routeId") as string) || "").trim() || null;
  const redirectTo = (formData.get("redirectTo") as string) || "/pianificazione-plus";
  if (!pickupId) return;

  await recalcAll(await placeStop({ pickupId }, routeId));

  revalidateRoutes(routeId ?? undefined);
  redirect(redirectTo);
}

/** Assegna/sposta/rimuove un reso da un giro (routeId vuoto = nessun giro). */
export async function setResoRoute(formData: FormData): Promise<void> {
  const resoId = formData.get("resoId") as string;
  const routeId = ((formData.get("routeId") as string) || "").trim() || null;
  const redirectTo = (formData.get("redirectTo") as string) || "/pianificazione";
  if (!resoId) return;

  await recalcAll(await placeStop({ resoId }, routeId));

  revalidateRoutes(routeId ?? undefined);
  redirect(redirectTo);
}

/** Rimuove una presa da un giro: torna da assegnare. */
export async function removePickupFromRoute(formData: FormData): Promise<void> {
  const routeId = formData.get("routeId") as string;
  const pickupId = formData.get("pickupId") as string;
  const redirectTo = (formData.get("redirectTo") as string) || `/giri/${routeId}`;
  if (!routeId || !pickupId) return;

  await prisma.routeStop.deleteMany({ where: { routeId, pickupId } });
  await recalcRouteKm(routeId);

  revalidateRoutes(routeId);
  redirect(redirectTo);
}

/** Sposta una fermata su/giù scambiando la sequenza con la vicina. */
export async function moveStop(formData: FormData): Promise<void> {
  const routeId = formData.get("routeId") as string;
  const stopId = formData.get("stopId") as string;
  const direction = formData.get("direction") as "up" | "down";
  if (!routeId || !stopId) return;

  const stops = await prisma.routeStop.findMany({
    where: { routeId },
    orderBy: { sequence: "asc" },
    select: { id: true, sequence: true },
  });

  const index = stops.findIndex((s) => s.id === stopId);
  if (index === -1) return;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= stops.length) return;

  const a = stops[index];
  const b = stops[swapWith];

  await prisma.$transaction([
    prisma.routeStop.update({ where: { id: a.id }, data: { sequence: b.sequence } }),
    prisma.routeStop.update({ where: { id: b.id }, data: { sequence: a.sequence } }),
  ]);
  await recalcRouteKm(routeId);

  revalidateRoutes(routeId);
  redirect(`/giri/${routeId}`);
}
