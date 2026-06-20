"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { customerSchema, parseForm, type ActionResult } from "@/lib/validations";

export async function upsertCustomer(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = (formData.get("id") as string) || undefined;
  const parsed = parseForm(customerSchema, formData);
  if (!parsed.success) return parsed.result;

  const data = parsed.data;

  if (id) {
    await prisma.customer.update({ where: { id }, data });
  } else {
    await prisma.customer.create({ data });
  }

  revalidatePath("/clienti");
  redirect("/clienti");
}

export async function deleteCustomer(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;

  // Non eliminare clienti con prese collegate: l'onDelete a cascata
  // distruggerebbe lo storico. Blocchiamo se ci sono prese.
  const pickupsCount = await prisma.pickup.count({ where: { customerId: id } });
  if (pickupsCount > 0) {
    // Restituiamo silenziosamente: la UI mostra l'avviso lato pagina.
    redirect(`/clienti?error=has-pickups`);
  }

  await prisma.customer.delete({ where: { id } });
  revalidatePath("/clienti");
  redirect("/clienti");
}
