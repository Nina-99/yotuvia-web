import type { ReactNode } from "react";

/**
 * Small accessible data table for the analytics leaderboards.
 *
 * Kept generic and dumb so the page owns column copy/formatting. Wrapped in a
 * horizontally scrollable container so the four-to-five column tables stay
 * usable on phones, with every header carrying `scope="col"` and the caption
 * exposed to assistive technology only (the visible heading sits above it).
 */
export interface DataTableColumn<T> {
  /** Already-translated header copy. */
  header: string;
  render: (row: T) => ReactNode;
  /** Right-align numeric columns. */
  align?: "left" | "right";
}

export interface DataTableProps<T> {
  caption: string;
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  rowKey: (row: T) => string | number;
  /** Rendered instead of the table when `rows` is empty. */
  emptyLabel: string;
}

export function DataTable<T>({ caption, rows, columns, rowKey, emptyLabel }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={`border-b border-border py-2 pr-3 font-medium text-text-muted ${
                  column.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={`border-b border-border py-2 pr-3 text-text ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
