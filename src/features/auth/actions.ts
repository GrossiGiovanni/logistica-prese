"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PASSWORD_CHANGED_KEY, MIN_PASSWORD_LENGTH } from "@/lib/auth-policy";

export type ChangePasswordState = { ok: boolean; error?: string } | null;

/**
 * Imposta una nuova password per l'utente loggato e registra il cambio.
 * Password e flag viaggiano nella STESSA chiamata: se Supabase rifiuta la
 * password, il flag non viene scritto e l'obbligo di cambio resta attivo.
 */
export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.` };
  }
  if (password !== confirm) {
    return { ok: false, error: "Le due password non coincidono." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { error } = await supabase.auth.updateUser({
    password,
    data: { [PASSWORD_CHANGED_KEY]: new Date().toISOString() },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    const code = (error as { code?: string }).code ?? "";
    // Sessione troppo vecchia per cambiare password (impostazione di sicurezza
    // di Supabase): invece di lasciare l'utente bloccato su questa pagina, lo
    // facciamo rientrare. Con la sessione fresca il cambio va a buon fine.
    if (code === "reauthentication_needed" || msg.includes("reauthenticat")) {
      await supabase.auth.signOut();
      redirect("/login?motivo=riaccesso");
    }
    if (msg.includes("different") || msg.includes("same")) {
      return { ok: false, error: "La nuova password deve essere diversa da quella attuale." };
    }
    if (msg.includes("weak") || msg.includes("characters") || msg.includes("length")) {
      return { ok: false, error: "Password troppo debole: usa più caratteri, con lettere e numeri." };
    }
    return { ok: false, error: "Impossibile aggiornare la password. Riprova." };
  }

  // Cambio riuscito: accesso normale (la scelta filiale avviene al passo successivo).
  redirect("/dashboard");
}

/** Disconnette l'utente e torna al login. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
