export type BadgeTone = "slate" | "blue" | "green" | "amber" | "red" | "purple";

const toneClasses: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-brand-50 text-brand-700 border-brand-100",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
};

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium " +
        toneClasses[tone]
      }
    >
      {children}
    </span>
  );
}
