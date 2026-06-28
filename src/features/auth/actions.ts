"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Disconnette l'utente e torna al login. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
