"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { BRANCH_COOKIE } from "@/lib/branch";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Seleziona la filiale operativa e la memorizza nel cookie. */
export async function selectBranch(formData: FormData): Promise<void> {
  const id = String(formData.get("branchId") ?? "").trim();
  const branch = id
    ? await prisma.branch.findFirst({ where: { id, active: true }, select: { id: true } })
    : null;
  if (!branch) redirect("/scegli-filiale");

  (await cookies()).set(BRANCH_COOKIE, branch!.id, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  redirect("/dashboard");
}

/** Torna alla schermata di scelta filiale (cambio filiale). */
export async function switchBranch(): Promise<void> {
  (await cookies()).delete(BRANCH_COOKIE);
  redirect("/scegli-filiale");
}
