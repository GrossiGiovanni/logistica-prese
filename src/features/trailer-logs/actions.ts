"use server";

// Registro "Autisti Eurosarda": aggancio semirimorchi in porto + servizio.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseDateOnly, isValidDateInput } from "@/lib/dates";

export async function createTrailerLog(formData: FormData): Promise<void> {
  const logDate = (formData.get("logDate") as string) || "";
  const driverId = (formData.get("driverId") as string) || "";
  const trailerPlate = ((formData.get("trailerPlate") as string) || "").trim().toUpperCase();
  const service = ((formData.get("service") as string) || "").trim();

  if (!isValidDateInput(logDate) || !driverId || !trailerPlate || !service) {
    redirect(`/autisti-eurosarda?error=campi`);
  }

  await prisma.trailerLog.create({
    data: { logDate: parseDateOnly(logDate), driverId, trailerPlate, service },
  });

  revalidatePath("/autisti-eurosarda");
  // Mostra il giorno appena registrato (range = quel giorno).
  redirect(`/autisti-eurosarda?from=${logDate}&to=${logDate}`);
}

export async function updateTrailerLog(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const logDate = (formData.get("logDate") as string) || "";
  const driverId = (formData.get("driverId") as string) || "";
  const trailerPlate = ((formData.get("trailerPlate") as string) || "").trim().toUpperCase();
  const service = ((formData.get("service") as string) || "").trim();
  const back = (formData.get("back") as string) || "";
  if (!id) return;

  if (isValidDateInput(logDate) && driverId && trailerPlate && service) {
    await prisma.trailerLog.update({
      where: { id },
      data: { logDate: parseDateOnly(logDate), driverId, trailerPlate, service },
    });
  }
  revalidatePath("/autisti-eurosarda");
  redirect(back ? `/autisti-eurosarda?${back}` : "/autisti-eurosarda");
}

export async function deleteTrailerLog(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const back = (formData.get("back") as string) || "";
  if (!id) return;
  await prisma.trailerLog.delete({ where: { id } });
  revalidatePath("/autisti-eurosarda");
  redirect(back ? `/autisti-eurosarda?${back}` : "/autisti-eurosarda");
}
