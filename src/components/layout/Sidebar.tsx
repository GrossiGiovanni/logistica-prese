"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/features/auth/actions";
import { switchBranch } from "@/features/branch/actions";
import { Logo } from "./Logo";

type BranchInfo = { id: string; name: string; code: string };

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
      // "Prese fisse" sospesa: le prese arrivano tutte dall'import AS400.
      // { href: "/prese-fisse", label: "Prese fisse" },
    ],
  },
  { href: "/giri", label: "Giri" },
  {
    label: "Report",
    children: [
      { href: "/storico", label: "Storico" },
      { href: "/report-mensile", label: "Report mensile" },
      { href: "/autisti-eurosarda", label: "Autisti Eurosarda" },
      { href: "/trazioni", label: "Trazioni Eurosarda" },
    ],
  },
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

export function Sidebar({ userEmail, branch }: { userEmail?: string; branch?: BranchInfo | null }) {
  const pathname = usePathname();

  // Niente sidebar nella pagina di login o nella scelta filiale.
  if (pathname === "/login" || pathname === "/scegli-filiale") return null;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 pb-3 pt-4">
        <Logo className="w-full" />
        <div className="mt-1 text-center text-[11px] font-medium uppercase tracking-widest text-slate-400">
          Pianificazione ritiri
        </div>
      </div>

      {branch ? (
        <div className="border-b border-slate-200 px-3 py-2">
          <div className="flex items-center justify-between rounded-md bg-brand-50 px-2.5 py-1.5">
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-wide text-brand-500">Filiale</div>
              <div className="truncate text-sm font-semibold text-brand-700">{branch.name}</div>
            </div>
            <form action={switchBranch}>
              <button
                type="submit"
                className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-100"
                title="Cambia filiale"
              >
                Cambia
              </button>
            </form>
          </div>
        </div>
      ) : null}
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
