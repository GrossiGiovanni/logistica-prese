"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { vehicleSchema, parseForm, type ActionResult } from "@/lib/validations";

export async function upsertVehicle(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = (formData.get("id") as string) || undefined;
  const parsed = parseForm(vehicleSchema, formData);
  if (!parsed.success) return parsed.result;

  const data = parsed.data;

  if (id) {
    await prisma.vehicle.update({ where: { id }, data });
  } else {
    await prisma.vehicle.create({ data });
  }

  revalidatePath("/mezzi");
  redirect("/mezzi");
}

export async function deleteVehicle(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;
  // Soft delete: i mezzi possono essere usati in giri storici.
  await prisma.vehicle.update({ where: { id }, data: { active: false } });
  revalidatePath("/mezzi");
  redirect("/mezzi");
}
