"use server";

// Anagrafica trazionisti: nome/vettore e nolo (costo di trazione) predefinito.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/branch";

function num(formData: FormData, key: string): number | null {
  const raw = ((formData.get(key) as string | null) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export async function upsertTrazionista(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string) || "";
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) redirect("/trazionisti?error=campi");

  const data = {
    name,
    defaultCost: num(formData, "defaultCost"),
    notes: ((formData.get("notes") as string) || "").trim() || null,
    active: formData.get("active") !== null,
  };

  if (id) {
    await prisma.trazionista.update({ where: { id }, data });
  } else {
    const branchId = await requireBranchId();
    await prisma.trazionista.create({ data: { ...data, branchId } });
  }

  revalidatePath("/trazionisti");
  revalidatePath("/carichi");
  redirect("/trazionisti");
}

export async function deleteTrazionista(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  if (!id) return;
  // I carichi già registrati restano: il riferimento viene semplicemente azzerato.
  await prisma.trazionista.delete({ where: { id } });
  revalidatePath("/trazionisti");
  revalidatePath("/carichi");
  redirect("/trazionisti");
}
