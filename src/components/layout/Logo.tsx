// Logo Eurosarda ufficiale (public/logo-eurosarda.png).
/* eslint-disable @next/next/no-img-element */

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo-eurosarda.png"
      alt="Eurosarda S.p.A — Logistica & Sardegna dal 1947"
      className={className}
    />
  );
}
