"use server";

// Carichi: inserimento manuale di informazioni di carico per il magazzino,
// indipendenti da prese e giri (nessun collegamento alla pianificazione).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/branch";
import { parseDateOnly, isValidDateInput } from "@/lib/dates";

/** Numero >= 0 o null da un campo form (vuoto = null). */
function num(formData: FormData, key: string, integer = false): number | null {
  const raw = ((formData.get(key) as string | null) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null;
  return integer ? Math.round(n) : n;
}

/** Stringa ripulita o null (vuoto = null). */
function str(formData: FormData, key: string, upper = false): string | null {
  const raw = ((formData.get(key) as string | null) ?? "").trim();
  if (!raw) return null;
  return upper ? raw.toUpperCase() : raw;
}

export async function upsertCarico(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string) || "";
  const loadDate = (formData.get("loadDate") as string) || "";
  const carrier = ((formData.get("carrier") as string) || "").trim();
  const back = (formData.get("back") as string) || "";

  // Data e vettore sono i due campi obbligatori.
  if (!isValidDateInput(loadDate) || !carrier) {
    redirect(`/carichi?error=campi${back ? `&${back}` : ""}`);
  }

  const data = {
    loadDate: parseDateOnly(loadDate),
    carrier,
    plate: str(formData, "plate", true),
    destination: str(formData, "destination"),
    reference: str(formData, "reference"),
    pallets: num(formData, "pallets", true),
    colli: num(formData, "colli", true),
    weightKg: num(formData, "weightKg"),
    volumeM3: num(formData, "volumeM3"),
    notes: str(formData, "notes"),
  };

  if (id) {
    await prisma.carico.update({ where: { id }, data });
  } else {
    const branchId = await requireBranchId();
    await prisma.carico.create({ data: { ...data, branchId } });
  }

  revalidatePath("/carichi");
  redirect(back ? `/carichi?${back}` : `/carichi?from=${loadDate}&to=${loadDate}`);
}

export async function deleteCarico(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const back = (formData.get("back") as string) || "";
  if (!id) return;
  await prisma.carico.delete({ where: { id } });
  revalidatePath("/carichi");
  redirect(back ? `/carichi?${back}` : "/carichi");
}
