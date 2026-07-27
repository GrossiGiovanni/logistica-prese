"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/branch";
import { driverSchema, parseForm, type ActionResult } from "@/lib/validations";

export async function upsertDriver(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = (formData.get("id") as string) || undefined;
  const parsed = parseForm(driverSchema, formData);
  if (!parsed.success) return parsed.result;

  const { defaultVehicleId, ...rest } = parsed.data;
  const data = { ...rest, defaultVehicleId: defaultVehicleId ?? null };

  if (id) {
    await prisma.driver.update({ where: { id }, data });
  } else {
    const branchId = await requireBranchId();
    await prisma.driver.create({ data: { ...data, branchId } });
  }

  revalidatePath("/autisti");
  redirect("/autisti");
}

export async function deleteDriver(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;
  // Soft delete: gli autisti possono comparire in giri storici.
  await prisma.driver.update({ where: { id }, data: { active: false } });
  revalidatePath("/autisti");
  redirect("/autisti");
}
