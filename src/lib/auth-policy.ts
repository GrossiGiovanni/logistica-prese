// Politica account: obbligo di cambio password al primo accesso.
// Modulo PURO (nessun import server-only): usato anche dal middleware edge.
//
// Il flag vive nei metadati dell'utente Supabase ed è scritto nella STESSA
// chiamata che cambia la password (updateUser({ password, data })): se il cambio
// fallisce, il flag non viene impostato. Gli account esistenti non hanno il flag,
// quindi al prossimo accesso devono scegliere una nuova password.

export const PASSWORD_CHANGED_KEY = "password_changed_at";
export const CHANGE_PASSWORD_PATH = "/cambia-password";
export const LOGIN_PATH = "/login";
export const MIN_PASSWORD_LENGTH = 8;

type UserLike = { user_metadata?: Record<string, unknown> | null } | null | undefined;

/** True se l'utente deve ancora impostare una password propria. */
export function mustChangePassword(user: UserLike): boolean {
  if (!user) return false;
  return !user.user_metadata?.[PASSWORD_CHANGED_KEY];
}

/**
 * Interruttore di emergenza: AUTH_FORCE_PASSWORD_CHANGE=off (o false/0) disattiva
 * l'obbligo senza modificare il codice, ad es. impostandolo su Vercel.
 * Di default l'obbligo è attivo.
 */
export function isForcedPasswordChangeEnabled(value = process.env.AUTH_FORCE_PASSWORD_CHANGE): boolean {
  return !/^(off|false|0|no)$/i.test((value ?? "").trim());
}

/**
 * Decisione di instradamento per l'autenticazione (pura, quindi collaudabile).
 * Restituisce il percorso verso cui reindirizzare, oppure null per proseguire.
 */
export function decideAuthRedirect(args: {
  hasUser: boolean;
  mustChange: boolean;
  path: string;
  forceEnabled: boolean;
}): string | null {
  const { hasUser, mustChange, path, forceEnabled } = args;
  const isLogin = path === LOGIN_PATH || path.startsWith(LOGIN_PATH + "/");

  // Non autenticato: tutto porta al login (che resta l'unica pagina pubblica).
  if (!hasUser) return isLogin ? null : LOGIN_PATH;

  // Primo accesso: ogni percorso porta al cambio password, finché non è fatto.
  if (forceEnabled && mustChange && path !== CHANGE_PASSWORD_PATH) return CHANGE_PASSWORD_PATH;

  // Già autenticato sulla pagina di login: dentro l'app.
  if (isLogin) return "/dashboard";

  return null;
}
