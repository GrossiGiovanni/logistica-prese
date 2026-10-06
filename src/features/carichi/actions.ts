"use server";

// Carichi: inserimento manuale di informazioni di carico per il magazzino,
// indipendenti da prese e giri (nessun collegamento alla pianificazione).
// Campi gestiti: data, vettore (dall'anagrafica trazionisti), autista
// Eurosarda (se il carico è una trazione fatta da Eurosarda), note, nolo.
// I Carichi sono l'UNICA fonte delle trazioni: un carico fatto da Eurosarda
// (autista Eurosarda o vettore Eurosarda) è una trazione industriale.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/branch";
import { parseDateOnly, isValidDateInput } from "@/lib/dates";

/** Numero >= 0 o null da un campo form (vuoto = null). */
function num(formData: FormData, key: string): number | null {
  const raw = ((formData.get(key) as string | null) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export async function upsertCarico(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string) || "";
  const loadDate = (formData.get("loadDate") as string) || "";
  const carrier = ((formData.get("carrier") as string) || "").trim();
  const trazionistaId = ((formData.get("trazionistaId") as string) || "").trim() || null;
  const driverId = ((formData.get("driverId") as string) || "").trim() || null;
  const back = (formData.get("back") as string) || "";

  // Data e vettore sono i due campi obbligatori.
  if (!isValidDateInput(loadDate) || !carrier) {
    redirect(`/carichi?error=campi${back ? `&${back}` : ""}`);
  }

  const branchId = await requireBranchId();
  // L'autista deve essere della filiale corrente (mai id arbitrari dal form).
  if (driverId) {
    const ok = await prisma.driver.count({ where: { id: driverId, branchId } });
    if (!ok) redirect(`/carichi?error=campi${back ? `&${back}` : ""}`);
  }

  const data = {
    loadDate: parseDateOnly(loadDate),
    carrier,
    trazionistaId,
    driverId,
    nolo: num(formData, "nolo"),
    notes: ((formData.get("notes") as string) || "").trim() || null,
  };

  if (id) {
    await prisma.carico.updateMany({ where: { id, branchId }, data });
  } else {
    await prisma.carico.create({ data: { ...data, branchId } });
  }

  revalidatePath("/carichi");
  // I noli alimentano i costi (Home, report giornaliero e mensile).
  revalidatePath("/dashboard");
  revalidatePath("/report-mensile");
  revalidatePath("/pianificazione");
  redirect(back ? `/carichi?${back}` : `/carichi?from=${loadDate}&to=${loadDate}`);
}

export async function deleteCarico(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const back = (formData.get("back") as string) || "";
  if (!id) return;
  await prisma.carico.deleteMany({ where: { id, branchId: await requireBranchId() } });
  revalidatePath("/carichi");
  revalidatePath("/dashboard");
  revalidatePath("/report-mensile");
  revalidatePath("/pianificazione");
  redirect(back ? `/carichi?${back}` : "/carichi");
}
