"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/features/auth/actions";
import { Logo } from "./Logo";

type NavLink = { href: string; label: string };
type NavItem = NavLink | { label: string; children: NavLink[] };

const nav: NavItem[] = [
  { href: "/dashboard", label: "Home" },
  {
    label: "Pianificazione",
    children: [
      { href: "/pianificazione", label: "Pianificazione" },
      { href: "/pianificazione-plus", label: "Pianificazione Plus" },
    ],
  },
  {
    label: "Prese",
    children: [
      { href: "/prese", label: "Prese" },
      { href: "/importa", label: "Importa" },
      { href: "/prese-fisse", label: "Prese fisse" },
    ],
  },
  { href: "/giri", label: "Giri" },
  {
    label: "Anagrafica",
    children: [
      { href: "/clienti", label: "Clienti" },
      { href: "/autisti", label: "Autisti" },
      { href: "/mezzi", label: "Mezzi" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

const linkClass = (active: boolean, nested = false) =>
  "block rounded-md py-2 text-sm font-medium transition " +
  (nested ? "px-3 pl-6 " : "px-3 ") +
  (active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100");

function NavGroup({ label, links }: { label: string; links: NavLink[] }) {
  const pathname = usePathname();
  const hasActive = links.some((c) => isActive(pathname, c.href));
  const [open, setOpen] = useState(hasActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition " +
          (hasActive ? "text-brand-700" : "text-slate-600 hover:bg-slate-100")
        }
      >
        <span>{label}</span>
        <span className={"text-xs transition-transform " + (open ? "rotate-90" : "")}>▸</span>
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5">
          {links.map((c) => (
            <Link key={c.href} href={c.href} className={linkClass(isActive(pathname, c.href), true)}>
              {c.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  // Niente sidebar nella pagina di login.
  if (pathname === "/login") return null;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 pb-3 pt-4">
        <Logo className="w-full" />
        <div className="mt-1 text-center text-[11px] font-medium uppercase tracking-widest text-slate-400">
          Pianificazione ritiri
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {nav.map((item) =>
          "children" in item ? (
            <NavGroup key={item.label} label={item.label} links={item.children} />
          ) : (
            <Link key={item.href} href={item.href} className={linkClass(isActive(pathname, item.href))}>
              {item.label}
            </Link>
          ),
        )}
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
