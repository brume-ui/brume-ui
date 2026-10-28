export interface CompactTableProps {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  /** Accessible name (visually hidden). */
  caption?: string;
}

/** A cell value as plain text (also the grid's fallback when a column has no display). */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * A small read-only table for nested data (inside a cell, a row detail or a dialog). It never
 * grows past its container: cells wrap (anywhere, if they must) instead of being clipped, also
 * inside a `truncate` table cell.
 */
export function CompactTable({ columns, rows, caption }: CompactTableProps) {
  return (
    <table className="br:max-w-full br:border-collapse br:text-xs br:text-text">
      {caption ? <caption className="br:sr-only">{caption}</caption> : null}
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              scope="col"
              className="br:border-b br:border-border br:px-2 br:py-1 br:text-left br:font-semibold br:whitespace-normal br:wrap-anywhere br:text-text-muted"
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: nested rows have no id
          <tr key={i}>
            {columns.map((col) => (
              <td
                key={col.key}
                className="br:border-b br:border-border br:px-2 br:py-1 br:whitespace-normal br:wrap-anywhere"
              >
                {formatCell(row[col.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
