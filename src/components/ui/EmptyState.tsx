import Link from "next/link";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {description ? (
        <div className="max-w-sm text-sm text-slate-500">{description}</div>
      ) : null}
      {action ? (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
