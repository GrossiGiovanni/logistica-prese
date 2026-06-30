"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";
import { pickupSchema, parseForm, type ActionResult } from "@/lib/validations";
import { parseDateOnly } from "@/lib/dates";

function field(formData: FormData, key: string): string {
  return ((formData.get(key) as string | null) ?? "").trim();
}

export async function upsertPickup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = (formData.get("id") as string) || undefined;

  // Creazione rapida (solo in inserimento): nuovo cliente e/o nuovo indirizzo.
  if (!id) {
    const newCustomerName = field(formData, "newCustomerName");
    if (newCustomerName) {
      const c = await prisma.customer.create({ data: { name: newCustomerName } });
      formData.set("customerId", c.id);
    }

    const newStreet = field(formData, "newStreet");
    if (newStreet) {
      const customerId = field(formData, "customerId");
      if (!customerId) return { ok: false, error: "Seleziona o crea prima un cliente." };
      const city = field(formData, "newCity");
      const province = field(formData, "newProvince");
      if (!city || !province) {
        return { ok: false, error: "Indirizzo incompleto: via, città e provincia sono obbligatori." };
      }
      const postalCode = field(formData, "newPostalCode") || undefined;
      const label = field(formData, "newLabel") || undefined;
      const coords = await geocodeAddress({ street: newStreet, city, province, postalCode });
      const a = await prisma.address.create({
        data: {
          customerId,
          street: newStreet,
          city,
          province,
          postalCode,
          label,
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        },
      });
      formData.set("addressId", a.id);
    }
  }

  const parsed = parseForm(pickupSchema, formData);
  if (!parsed.success) return parsed.result;

  const { pickupDate, ...rest } = parsed.data;
  const data = { ...rest, pickupDate: parseDateOnly(pickupDate) };

  if (id) {
    await prisma.pickup.update({ where: { id }, data });
  } else {
    await prisma.pickup.create({ data });
  }

  revalidatePath("/prese");
  revalidatePath("/pianificazione");
  revalidatePath("/dashboard");
  redirect("/prese");
}

/** Imposta rapidamente la fascia operativa di una presa (dalla pianificazione). */
export async function setPickupTimeWindow(formData: FormData): Promise<void> {
  const pickupId = formData.get("pickupId") as string;
  const timeWindow = formData.get("timeWindow") as "MORNING" | "AFTERNOON" | "ANYTIME";
  const redirectTo = (formData.get("redirectTo") as string) || "/pianificazione";
  if (!pickupId || !timeWindow) return;

  await prisma.pickup.update({ where: { id: pickupId }, data: { timeWindow } });

  revalidatePath("/pianificazione");
  revalidatePath("/prese");
  revalidatePath("/dashboard");
  redirect(redirectTo);
}

/** Annulla logicamente una presa (status = CANCELLED). */
export async function cancelPickup(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.pickup.update({ where: { id }, data: { status: "CANCELLED" } });
  // Rimuove la presa da eventuali giri.
  await prisma.routeStop.deleteMany({ where: { pickupId: id } });

  revalidatePath("/prese");
  revalidatePath("/pianificazione");
  revalidatePath("/dashboard");
  redirect("/prese");
}
