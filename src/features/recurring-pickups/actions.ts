"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  recurringPickupSchema,
  parseForm,
  type ActionResult,
} from "@/lib/validations";
import { generateRecurringPickups } from "./generate";
import { isValidDateInput } from "@/lib/dates";

export async function upsertRecurringPickup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = (formData.get("id") as string) || undefined;
  const parsed = parseForm(recurringPickupSchema, formData);
  if (!parsed.success) return parsed.result;

  const data = parsed.data;

  if (id) {
    await prisma.recurringPickup.update({ where: { id }, data });
  } else {
    await prisma.recurringPickup.create({ data });
  }

  revalidatePath("/prese-fisse");
  redirect("/prese-fisse");
}

export async function deleteRecurringPickup(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;
  await prisma.recurringPickup.delete({ where: { id } });
  revalidatePath("/prese-fisse");
  redirect("/prese-fisse");
}

/**
 * Server action: genera le prese fisse per la data indicata.
 * Reindirizza alla pagina di provenienza con l'esito.
 */
export async function generateRecurringAction(formData: FormData): Promise<void> {
  const date = formData.get("date") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/prese-fisse";

  if (!date || !isValidDateInput(date)) {
    redirect(`${redirectTo}?genError=date`);
  }

  const result = await generateRecurringPickups(date);

  revalidatePath("/prese");
  revalidatePath("/prese-fisse");
  revalidatePath("/pianificazione");
  revalidatePath("/dashboard");

  const sep = redirectTo.includes("?") ? "&" : "?";
  redirect(`${redirectTo}${sep}gen=${result.created}_${result.skipped}`);
}
