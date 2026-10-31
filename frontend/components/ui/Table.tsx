import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** Plain data table that scrolls sideways on small screens instead of squeezing. */
export function Table<T>({ rows, columns, rowKey, caption, empty }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T, index: number) => string; caption?: string; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-raised">
      <table className="w-full min-w-[640px] text-[14px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-surface-alt text-ink-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn("px-3 py-2.5 text-start font-bold whitespace-nowrap", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} className="align-top hover:bg-surface-alt/60">
              {columns.map((column) => (
                <td key={column.key} className={cn("px-3 py-2.5", column.className)}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-ink-muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
