// Contesto filiale (multi-filiale Milano / Torino / ...).
// La filiale corrente è memorizzata in un cookie e verificata su DB.
// Ogni query operativa deve filtrare per branchId per non mischiare i dati.

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const BRANCH_COOKIE = "branch";

export type BranchInfo = { id: string; name: string; code: string };

/** Id filiale dal cookie (non verificato). */
export async function getCurrentBranchId(): Promise<string | undefined> {
  return (await cookies()).get(BRANCH_COOKIE)?.value || undefined;
}

/**
 * Filiale corrente verificata su DB (deduplicata per richiesta).
 * Ritorna null se il cookie manca o punta a una filiale inesistente/disattivata.
 */
export const getCurrentBranch = cache(async (): Promise<BranchInfo | null> => {
  const id = await getCurrentBranchId();
  if (!id) return null;
  const b = await prisma.branch.findFirst({
    where: { id, active: true },
    select: { id: true, name: true, code: true },
  });
  return b ?? null;
});

/** Filiale corrente o redirect alla schermata di scelta. */
export async function requireBranch(): Promise<BranchInfo> {
  const b = await getCurrentBranch();
  if (!b) redirect("/scegli-filiale");
  return b;
}

/** Solo l'id filiale corrente (per i filtri delle query). Redirect se manca. */
export async function requireBranchId(): Promise<string> {
  return (await requireBranch()).id;
}

/** Elenco filiali attive (per la schermata di scelta e il selettore). */
export const listBranches = cache(async (): Promise<BranchInfo[]> => {
  return prisma.branch.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
});
