"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";
import { addressSchema, parseForm, type ActionResult } from "@/lib/validations";

export async function upsertAddress(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = (formData.get("id") as string) || undefined;
  const parsed = parseForm(addressSchema, formData);
  if (!parsed.success) return parsed.result;

  const data = parsed.data;

  if (id) {
    // Ri-geocodifica solo se i campi che compongono l'indirizzo sono cambiati.
    const existing = await prisma.address.findUnique({ where: { id } });
    const locationChanged =
      !existing ||
      existing.lat == null ||
      existing.street !== data.street ||
      existing.city !== data.city ||
      existing.province !== data.province ||
      (existing.postalCode ?? undefined) !== data.postalCode;

    const coords = locationChanged ? await geocodeAddress(data) : null;
    await prisma.address.update({
      where: { id },
      data: coords ? { ...data, lat: coords.lat, lng: coords.lng } : data,
    });
  } else {
    const coords = await geocodeAddress(data);
    await prisma.address.create({
      data: coords ? { ...data, lat: coords.lat, lng: coords.lng } : data,
    });
  }

  revalidatePath("/indirizzi");
  redirect("/indirizzi");
}

export async function deleteAddress(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;

  const pickupsCount = await prisma.pickup.count({ where: { addressId: id } });
  if (pickupsCount > 0) {
    redirect(`/indirizzi?error=has-pickups`);
  }

  await prisma.address.delete({ where: { id } });
  revalidatePath("/indirizzi");
  redirect("/indirizzi");
}
