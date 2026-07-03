import Link from "next/link";

type Action = {
  href?: string;
  label: string;
};

export function PageHeader({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: Action;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-8 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {action?.href ? (
          <Link href={action.href} className="btn-primary">
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
