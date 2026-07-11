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
    redirect(`/autisti-eurosarda?date=${logDate}&error=campi`);
  }

  await prisma.trailerLog.create({
    data: { logDate: parseDateOnly(logDate), driverId, trailerPlate, service },
  });

  revalidatePath("/autisti-eurosarda");
  redirect(`/autisti-eurosarda?date=${logDate}`);
}

export async function deleteTrailerLog(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const date = (formData.get("date") as string) || "";
  if (!id) return;
  await prisma.trailerLog.delete({ where: { id } });
  revalidatePath("/autisti-eurosarda");
  redirect(date ? `/autisti-eurosarda?date=${date}` : "/autisti-eurosarda");
}
