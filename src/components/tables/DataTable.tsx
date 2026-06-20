import { EmptyState } from "@/components/ui/EmptyState";

export type Column<T> = {
  header: string;
  /** Cella personalizzata. */
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: { title: string; description?: string; action?: { href: string; label: string } };
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={empty?.title ?? "Nessun dato"}
        description={empty?.description}
        action={empty?.action}
      />
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left">
            {columns.map((col, i) => (
              <th
                key={i}
                className={
                  "px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 " +
                  (col.className ?? "")
                }
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
            >
              {columns.map((col, i) => (
                <td key={i} className={"px-3 py-2 align-middle " + (col.className ?? "")}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
