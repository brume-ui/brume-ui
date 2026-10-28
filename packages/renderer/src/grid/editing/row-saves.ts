import type { GridRow } from '@brume-ui/brume-schema';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** Taken when a cell save starts; orders the rows that saves return. */
export interface RowSaveTicket {
  /** Grid-wide, increasing in the order the saves started. */
  readonly n: number;
  /** The `page.rows` the save started on. */
  readonly base: GridRow[];
}

/** `outdated`: `page.rows` changed since the save started, so the row was not used. */
export type RowSaveResult = 'applied' | 'outdated';

const PER_COLUMN_META = ['raw', 'href', 'content'] as const;

/** `target` with `column` (its value and its `_meta.raw` / `href` / `content` entries) from `source`. */
export function mergeColumn(target: GridRow, source: GridRow, column: string): GridRow {
  const meta: NonNullable<GridRow['_meta']> = { ...target._meta };
  for (const part of PER_COLUMN_META) {
    const from = source._meta?.[part] as Record<string, unknown> | undefined;
    const to = { ...(meta[part] as Record<string, unknown> | undefined) };
    if (from && column in from) to[column] = from[column];
    else delete to[column];
    (meta as Record<string, unknown>)[part] = Object.keys(to).length > 0 ? to : undefined;
  }
  return { ...target, [column]: source[column], _meta: meta };
}

interface RowOverride {
  /** The returned row with the newest ticket: other columns (display results) come from it. */
  row: GridRow;
  n: number;
  /** Per saved column, the row its own save returned: the authority for that column. */
  own: ReadonlyMap<string, GridRow>;
}

function showRow({ row, own }: RowOverride): GridRow {
  let shown = row;
  for (const [column, source] of own) shown = mergeColumn(shown, source, column);
  return shown;
}

/**
 * `page.rows` with what cell saves returned, by id. Replacements belong to the `page.rows` they
 * were saved on (a refresh or another view drops them).
 *
 * The server's order of two saves of one row is unknown, so a returned row is only trusted for
 * the column it saved (the cell keeps its own saves in order). The rest of the row comes from the
 * newest-started save whose row has landed. So a late response of one cell can never put back an
 * older value of another cell that has been saved.
 */
export function useRowSaves(pageRows: GridRow[]) {
  const [overrides, setOverrides] = useState<{
    base: GridRow[];
    byId: ReadonlyMap<string, RowOverride>;
  }>(() => ({ base: pageRows, byId: new Map() }));
  const latestRows = useRef(pageRows);
  useLayoutEffect(() => {
    latestRows.current = pageRows;
  }, [pageRows]);
  const counter = useRef(0);

  const beginRowSave = useCallback(
    (): RowSaveTicket => ({ n: ++counter.current, base: latestRows.current }),
    [],
  );

  const replaceRow = useCallback(
    (row: GridRow, ticket: RowSaveTicket, column: string): RowSaveResult => {
      const { base, n } = ticket;
      if (base !== latestRows.current) return 'outdated';
      const id = String(row.id);
      setOverrides((prev) => {
        const byId = new Map(prev.base === base ? prev.byId : []);
        const current = byId.get(id);
        const own = new Map(current?.own).set(column, row);
        byId.set(id, current && current.n > n ? { ...current, own } : { row, n, own });
        return { base, byId };
      });
      return 'applied';
    },
    [],
  );

  const rows = useMemo(() => {
    if (overrides.base !== pageRows || overrides.byId.size === 0) return pageRows;
    return pageRows.map((row) => {
      const override = overrides.byId.get(String(row.id));
      return override ? showRow(override) : row;
    });
  }, [overrides, pageRows]);
  const rowById = useMemo(() => new Map(rows.map((row) => [String(row.id), row])), [rows]);

  return { rows, rowById, beginRowSave, replaceRow };
}
