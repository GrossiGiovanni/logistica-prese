// Aggiorna la sessione Supabase e protegge le pagine: senza login si viene
// reindirizzati a /login. Rollout sicuro: se Supabase non è configurato (env
// mancanti) non blocca nulla, così il deploy non chiude fuori tutti.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  decideAuthRedirect,
  isForcedPasswordChangeEnabled,
  mustChangePassword,
} from "@/lib/auth-policy";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Decisione di instradamento centralizzata e collaudata (vedi auth-policy.ts):
  //  - non autenticato  -> /login;
  //  - primo accesso    -> /cambia-password da qualsiasi percorso (API ed export
  //    compresi); il middleware intercetta ogni richiesta, quindi vale anche per
  //    la navigazione lato client;
  //  - già loggato su /login -> /dashboard.
  const target = decideAuthRedirect({
    hasUser: Boolean(user),
    mustChange: mustChangePassword(user),
    path: request.nextUrl.pathname,
    forceEnabled: isForcedPasswordChangeEnabled(),
  });
  if (target) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = target;
    redirectUrl.search = "";
    return withCookies(NextResponse.redirect(redirectUrl), supabaseResponse);
  }

  return supabaseResponse;
}

/**
 * Copia sul redirect i cookie di sessione eventualmente rinnovati da Supabase:
 * senza, un redirect potrebbe perdere il token appena aggiornato e il
 * successivo accesso verrebbe trattato come non autenticato.
 */
function withCookies(target: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((c) => target.cookies.set(c));
  return target;
}
