"use server";

// Trazioni Eurosarda: tratte manuali punto A -> punto B con km calcolati e costo.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/branch";
import { parseDateOnly, isValidDateInput } from "@/lib/dates";

/**
 * Km stradali tra due indirizzi liberi tramite Google Directions.
 * Best-effort: null se chiave assente o errore.
 */
async function drivingKm(origin: string, destination: string): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !origin.trim() || !destination.trim()) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("region", "it");
    url.searchParams.set("key", key);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      routes?: { legs?: { distance?: { value: number } }[] }[];
    };
    if (data.status !== "OK" || !data.routes?.length) return null;
    const meters = (data.routes[0].legs ?? []).reduce((s, l) => s + (l.distance?.value ?? 0), 0);
    return Math.round(meters / 100) / 10;
  } catch {
    return null;
  }
}

function num(formData: FormData, key: string): number | null {
  const raw = ((formData.get(key) as string | null) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

export async function upsertTraction(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string) || "";
  const tractionDate = (formData.get("tractionDate") as string) || "";
  const origin = ((formData.get("origin") as string) || "").trim();
  const destination = ((formData.get("destination") as string) || "").trim();
  const back = (formData.get("back") as string) || "";
  const listDate = isValidDateInput(tractionDate) ? tractionDate : "";

  if (!isValidDateInput(tractionDate) || !origin || !destination) {
    redirect(`/trazioni?error=campi${back ? `&${back}` : ""}`);
  }

  // Km: usa il valore inserito a mano, altrimenti prova a calcolarlo dalla mappa.
  let km = num(formData, "km");
  if (km == null) km = await drivingKm(origin, destination);

  const data = {
    tractionDate: parseDateOnly(tractionDate),
    plate: ((formData.get("plate") as string) || "").trim().toUpperCase() || null,
    driverId: ((formData.get("driverId") as string) || "") || null,
    origin,
    destination,
    km,
    cost: num(formData, "cost"),
    notes: ((formData.get("notes") as string) || "").trim() || null,
  };

  if (id) {
    await prisma.traction.update({ where: { id }, data });
  } else {
    const branchId = await requireBranchId();
    await prisma.traction.create({ data: { ...data, branchId } });
  }

  revalidatePath("/trazioni");
  revalidatePath("/dashboard");
  revalidatePath("/report-mensile");
  redirect(back ? `/trazioni?${back}` : `/trazioni?from=${listDate}&to=${listDate}`);
}

export async function deleteTraction(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const back = (formData.get("back") as string) || "";
  if (!id) return;
  await prisma.traction.delete({ where: { id } });
  revalidatePath("/trazioni");
  revalidatePath("/dashboard");
  revalidatePath("/report-mensile");
  redirect(back ? `/trazioni?${back}` : "/trazioni");
}
