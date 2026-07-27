import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Nota: "branch" deve combaciare con BRANCH_COOKIE in src/lib/branch.ts.
// Qui usiamo la stringa letterale per non importare Prisma nell'edge runtime.
const BRANCH_COOKIE = "branch";
const BRANCH_EXEMPT = ["/login", "/scegli-filiale"];

export async function middleware(request: NextRequest) {
  const res = await updateSession(request);

  // Se l'auth ha già deciso un redirect (es. verso /login), rispettalo.
  if (res.headers.get("location")) return res;

  const path = request.nextUrl.pathname;
  const exempt =
    path.startsWith("/api") ||
    BRANCH_EXEMPT.some((p) => path === p || path.startsWith(p + "/"));

  // Nessuna filiale selezionata: manda alla schermata di scelta.
  if (!exempt && !request.cookies.get(BRANCH_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/scegli-filiale";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Esclude asset statici e immagini; tutto il resto passa dal controllo auth.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
