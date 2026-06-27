"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { routeSchema, parseForm, type ActionResult } from "@/lib/validations";
import { parseDateOnly, isValidDateInput } from "@/lib/dates";
import { computeRouteKm, addressToQuery } from "@/lib/distance";

function revalidateRoutes(routeId?: string) {
  revalidatePath("/giri");
  revalidatePath("/pianificazione");
  revalidatePath("/dashboard");
  if (routeId) revalidatePath(`/giri/${routeId}`);
}

/**
 * Ricalcola e salva i km del giro (magazzino → fermate in ordine → magazzino)
 * tramite Google Directions. Best-effort: se la chiave manca o l'API fallisce,
 * azzera a null senza interrompere l'operazione chiamante.
 */
export async function recalcRouteKm(routeId: string): Promise<void> {
  try {
    const stops = await prisma.routeStop.findMany({
      where: { routeId },
      orderBy: { sequence: "asc" },
      select: {
        pickup: {
          select: {
            address: {
              select: { street: true, city: true, province: true, postalCode: true },
            },
          },
        },
      },
    });
    const addresses = stops.map((s) => addressToQuery(s.pickup.address));
    const result = await computeRouteKm(addresses);
    // Salva solo se abbiamo un km valido o se il giro è vuoto (km=null corretto).
    // In caso di chiave assente o errore API NON sovrascrive l'ultimo km buono.
    if (result.km != null || result.reason === "no_stops") {
      await prisma.route.update({ where: { id: routeId }, data: { km: result.km } });
    }
  } catch (err) {
    console.warn("[recalcRouteKm] errore:", err);
  }
}

/** Stato a cui torna una presa rimossa da un giro, in base ai dati. */
function unplannedStatus(pallets: number | null): "READY" | "DRAFT" {
  return pallets != null ? "READY" : "DRAFT";
}

/** Crea un nuovo giro e reindirizza al suo dettaglio. */
export async function createRoute(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseForm(routeSchema, formData);
  if (!parsed.success) return parsed.result;

  const { routeDate, driverId, vehicleId, ...rest } = parsed.data;
  const route = await prisma.route.create({
    data: {
      ...rest,
      routeDate: parseDateOnly(routeDate),
      driverId: driverId ?? null,
      vehicleId: vehicleId ?? null,
    },
  });

  revalidateRoutes();
  redirect(`/giri/${route.id}`);
}

/** Aggiorna autista/mezzo/fascia/stato/note del giro. */
export async function updateRoute(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id") as string;
  if (!id) return { ok: false, error: "Giro non trovato." };

  const parsed = parseForm(routeSchema, formData);
  if (!parsed.success) return parsed.result;

  const { routeDate, driverId, vehicleId, ...rest } = parsed.data;
  await prisma.route.update({
    where: { id },
    data: {
      ...rest,
      routeDate: parseDateOnly(routeDate),
      driverId: driverId ?? null,
      vehicleId: vehicleId ?? null,
    },
  });

  revalidateRoutes(id);
  return { ok: true };
}

/** Ricalcola manualmente i km del giro (bottone "Ricalcola KM"). */
export async function recalculateRouteKm(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;
  await recalcRouteKm(id);
  revalidateRoutes(id);
  redirect(`/giri/${id}`);
}

/** Cambia lo stato del giro (DRAFT/CONFIRMED). */
export async function setRouteStatus(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const status = formData.get("status") as "DRAFT" | "CONFIRMED";
  if (!id) return;
  await prisma.route.update({ where: { id }, data: { status } });
  revalidateRoutes(id);
  redirect(`/giri/${id}`);
}

/** Elimina un giro: le prese assegnate tornano disponibili. */
export async function deleteRoute(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;

  const stops = await prisma.routeStop.findMany({
    where: { routeId: id },
    include: { pickup: { select: { id: true, pallets: true, status: true } } },
  });

  await prisma.$transaction([
    prisma.route.delete({ where: { id } }), // cascade cancella i RouteStop
    ...stops
      .filter((s) => s.pickup.status === "PLANNED")
      .map((s) =>
        prisma.pickup.update({
          where: { id: s.pickup.id },
          data: { status: unplannedStatus(s.pickup.pallets) },
        }),
      ),
  ]);

  revalidateRoutes();
  redirect("/giri");
}

/** Assegna una presa a un giro (in coda) e la porta in stato PLANNED. */
export async function assignPickupToRoute(formData: FormData): Promise<void> {
  const routeId = formData.get("routeId") as string;
  const pickupId = formData.get("pickupId") as string;
  const redirectTo = (formData.get("redirectTo") as string) || `/giri/${routeId}`;
  if (!routeId || !pickupId) return;

  const existing = await prisma.routeStop.findUnique({
    where: { routeId_pickupId: { routeId, pickupId } },
  });
  if (!existing) {
    const last = await prisma.routeStop.findFirst({
      where: { routeId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const nextSeq = (last?.sequence ?? 0) + 1;
    await prisma.$transaction([
      prisma.routeStop.create({ data: { routeId, pickupId, sequence: nextSeq } }),
      prisma.pickup.update({ where: { id: pickupId }, data: { status: "PLANNED" } }),
    ]);
    await recalcRouteKm(routeId);
  }

  revalidateRoutes(routeId);
  redirect(redirectTo);
}

/** Rimuove una presa da un giro; se non è in altri giri, torna disponibile. */
export async function removePickupFromRoute(formData: FormData): Promise<void> {
  const routeId = formData.get("routeId") as string;
  const pickupId = formData.get("pickupId") as string;
  const redirectTo = (formData.get("redirectTo") as string) || `/giri/${routeId}`;
  if (!routeId || !pickupId) return;

  await prisma.routeStop.deleteMany({ where: { routeId, pickupId } });
  await recalcRouteKm(routeId);

  const stillAssigned = await prisma.routeStop.count({ where: { pickupId } });
  if (stillAssigned === 0) {
    const pickup = await prisma.pickup.findUnique({
      where: { id: pickupId },
      select: { pallets: true, status: true },
    });
    if (pickup && pickup.status === "PLANNED") {
      await prisma.pickup.update({
        where: { id: pickupId },
        data: { status: unplannedStatus(pickup.pallets) },
      });
    }
  }

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
