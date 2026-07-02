"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/features/auth/actions";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pianificazione", label: "Pianificazione" },
  { href: "/prese", label: "Prese" },
  { href: "/importa", label: "Importa Prese" },
  { href: "/prese-fisse", label: "Prese fisse" },
  { href: "/giri", label: "Giri" },
  { href: "/clienti", label: "Clienti" },
  { href: "/autisti", label: "Autisti" },
  { href: "/mezzi", label: "Mezzi" },
];

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  // Niente sidebar nella pagina di login.
  if (pathname === "/login") return null;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="text-sm font-bold uppercase tracking-wide text-brand-700">
          Logistica Prese
        </div>
        <div className="text-xs text-slate-500">Pianificazione ritiri</div>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "block rounded-md px-3 py-2 text-sm font-medium transition " +
                (active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 px-4 py-3">
        {userEmail ? (
          <div className="mb-2 truncate text-xs text-slate-500" title={userEmail}>
            {userEmail}
          </div>
        ) : null}
        <form action={signOut}>
          <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100">
            Esci
          </button>
        </form>
      </div>
    </aside>
  );
}
