import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./skeleton";

export interface TableColumn<TRow> {
  key: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
  /** Numbers, money and times align to the end edge. */
  align?: "start" | "end";
  className?: string;
}

interface DataTableProps<TRow> {
  columns: readonly TableColumn<TRow>[];
  rows: readonly TRow[];
  getRowKey: (row: TRow) => string;
  /** Describes the table for screen readers; hidden visually. */
  caption: string;
  isLoading?: boolean;
  /** Shown instead of the body when there are no rows. */
  empty?: ReactNode;
  loadingRows?: number;
  className?: string;
}

/**
 * A data table that scrolls sideways inside its own box, so the page itself never does.
 * Sorting, filters and paging are composed around it per screen.
 */
export function DataTable<TRow>({
  columns,
  rows,
  getRowKey,
  caption,
  isLoading = false,
  empty,
  loadingRows = 5,
  className,
}: DataTableProps<TRow>) {
  const showEmpty = !isLoading && rows.length === 0 && empty;

  return (
    <div
      className={cn("overflow-hidden rounded-card border border-line bg-surface-raised", className)}
    >
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full border-collapse text-body-sm" aria-busy={isLoading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-alt">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "h-11 border-b border-line px-4 text-label whitespace-nowrap text-ink-muted",
                    column.align === "end" ? "text-end" : "text-start",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading
              ? Array.from({ length: loadingRows }, (_, index) => (
                  <tr key={`loading-${index}`}>
                    {columns.map((column) => (
                      <td key={column.key} className="h-14 px-4">
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={getRowKey(row)} className="transition-colors hover:bg-surface-alt">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "h-14 px-4 whitespace-nowrap text-ink",
                          column.align === "end" ? "text-end num" : "text-start",
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {showEmpty ? <div className="p-4">{empty}</div> : null}
    </div>
  );
}
