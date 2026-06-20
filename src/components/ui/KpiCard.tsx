type Tone = "default" | "amber" | "red" | "green" | "blue";

const toneClasses: Record<Tone, string> = {
  default: "text-slate-900",
  amber: "text-amber-600",
  red: "text-red-600",
  green: "text-emerald-600",
  blue: "text-brand-600",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={"mt-1 text-2xl font-bold " + toneClasses[tone]}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  );
}
