// Logo Eurosarda — versione vettoriale (emblema strada + wordmark).
// Quando sarà disponibile il PNG/SVG ufficiale basterà sostituire il contenuto
// di questo componente con <img src="/logo-eurosarda.png" ... />.

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 120"
      role="img"
      aria-label="Eurosarda S.p.A — Logistica & Sardegna dal 1947"
      className={className}
    >
      {/* Emblema: ellisse con strada in prospettiva */}
      <g transform="translate(62,58) rotate(-10)">
        <ellipse rx="56" ry="37" fill="#2b3990" />
        <path
          d="M -48 26 Q -14 14 -3 -6 Q 3 -20 5 -35 L 24 -28 Q 17 -6 3 12 Q -14 30 -34 37 Z"
          fill="#ffffff"
        />
        <path
          d="M -38 29 Q -2 12 13 -30"
          stroke="#2b3990"
          strokeWidth="3.5"
          strokeDasharray="9 8"
          fill="none"
        />
      </g>

      {/* Wordmark */}
      <text
        x="128"
        y="76"
        fontSize="62"
        fontStyle="italic"
        fontWeight="800"
        fill="#2b3990"
        fontFamily="'Segoe UI', Arial, sans-serif"
        letterSpacing="-2"
      >
        eurosarda
      </text>
      <text
        x="134"
        y="102"
        fontSize="16"
        fontStyle="italic"
        fontWeight="700"
        fill="#2b3990"
        fontFamily="'Segoe UI', Arial, sans-serif"
      >
        S.p.A
      </text>
      <text
        x="205"
        y="102"
        fontSize="13.5"
        fontWeight="700"
        fill="#2b3990"
        letterSpacing="2.5"
        fontFamily="'Segoe UI', Arial, sans-serif"
      >
        LOGISTICA &amp; SARDEGNA DAL 1947
      </text>
    </svg>
  );
}
