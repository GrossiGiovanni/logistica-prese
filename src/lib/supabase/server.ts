// Client Supabase lato server (Server Components / Server Actions).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // chiamato da un Server Component: ignorabile (il refresh avviene nel middleware)
          }
        },
      },
    },
  );
}

/** Email dell'utente loggato, o undefined (anche se Supabase non è configurato). */
export async function getCurrentUserEmail(): Promise<string | undefined> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return undefined;
  }
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? undefined;
  } catch {
    return undefined;
  }
}
