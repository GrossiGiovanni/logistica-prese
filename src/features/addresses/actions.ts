"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
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
    await prisma.address.update({ where: { id }, data });
  } else {
    await prisma.address.create({ data });
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
