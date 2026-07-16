"use server";

// Resi: uscite per sola consegna di resi al cliente (nessun ritiro associato).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { resoSchema, parseForm, type ActionResult } from "@/lib/validations";
import { parseDateOnly } from "@/lib/dates";

export async function upsertReso(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = (formData.get("id") as string) || undefined;

  // Creazione rapida cliente (solo in inserimento).
  if (!id) {
    const newCustomerName = ((formData.get("newCustomerName") as string) || "").trim();
    if (newCustomerName) {
      const c = await prisma.customer.create({ data: { name: newCustomerName } });
      formData.set("customerId", c.id);
    }
  }

  const parsed = parseForm(resoSchema, formData);
  if (!parsed.success) return parsed.result;

  const { resoDate, addressId, ...rest } = parsed.data;
  const data = {
    ...rest,
    resoDate: parseDateOnly(resoDate),
    addressId: addressId ?? null,
  };

  if (id) {
    await prisma.reso.update({ where: { id }, data });
  } else {
    await prisma.reso.create({ data });
  }

  revalidatePath("/pianificazione");
  redirect(`/pianificazione?date=${resoDate}`);
}

export async function deleteReso(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/pianificazione";
  if (!id) return;
  await prisma.reso.delete({ where: { id } });
  revalidatePath("/pianificazione");
  redirect(redirectTo);
}
