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

  const { lat: manualLat, lng: manualLng, ...data } = parsed.data;

  // Coordinate: se inserite a mano nel form vincono sul geocoding; se lasciate
  // vuote vengono ricalcolate dall'indirizzo (svuotarle = "rigenera coordinate").
  let coords: { lat: number | null; lng: number | null };
  if (manualLat != null && manualLng != null) {
    coords = { lat: manualLat, lng: manualLng };
  } else {
    const geo = await geocodeAddress(data);
    coords = { lat: geo?.lat ?? null, lng: geo?.lng ?? null };
  }

  if (id) {
    await prisma.address.update({ where: { id }, data: { ...data, ...coords } });
  } else {
    await prisma.address.create({ data: { ...data, ...coords } });
  }

  // Gli indirizzi si gestiscono dalla scheda cliente.
  const customerPath = `/clienti/${data.customerId}/modifica`;
  revalidatePath(customerPath);
  redirect(customerPath);
}

export async function deleteAddress(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;

  const address = await prisma.address.findUnique({
    where: { id },
    select: { customerId: true, _count: { select: { pickups: true } } },
  });
  if (!address) return;

  const customerPath = `/clienti/${address.customerId}/modifica`;
  if (address._count.pickups > 0) {
    redirect(`${customerPath}?error=has-pickups`);
  }

  await prisma.address.delete({ where: { id } });
  revalidatePath(customerPath);
  redirect(customerPath);
}
