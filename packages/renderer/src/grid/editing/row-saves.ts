import type { GridRow } from '@brume-ui/brume-schema';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** Taken when a cell save starts; orders the rows that saves return. */
export interface RowSaveTicket {
  /** Grid-wide, increasing in the order the saves started. */
  readonly n: number;
  /** The row's id, as a string. */
  readonly id: string;
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

interface OwnColumn {
  /** The row this column's save returned. */
  source: GridRow;
  /** The ticket counter when it landed: a save started after that returns a row that includes it. */
  landedAt: number;
}

interface RowOverride {
  /** The returned row with the newest ticket: other columns (display results) come from it. */
  row: GridRow;
  n: number;
  /**
   * Per column whose save overlapped a later-started one, the row its own save returned: the
   * authority for that column until a save that started after it lands.
   */
  own: ReadonlyMap<string, OwnColumn>;
}

function showRow({ row, own }: RowOverride): GridRow {
  let shown = row;
  for (const [column, { source }] of own) shown = mergeColumn(shown, source, column);
  return shown;
}

/**
 * `page.rows` with what cell saves returned, by id. Replacements belong to the `page.rows` they
 * were saved on (a refresh or another view drops them).
 *
 * A returned row normally replaces the whole row. When saves of one row overlap, the server's
 * order is unknown, so a returned row is trusted for the column it saved (the cell keeps its own
 * saves in order) and the rest comes from the newest-started save whose row has landed; a late
 * response of one cell can never put back an older value of another saved cell. A column's own
 * row is dropped once a save that started after it landed returns, since that row includes it.
 * `endRowSave` says when the last of several overlapping saves has settled, so the caller can let
 * the server's rows decide the rest.
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
  // Saves in flight per row id, and whether two of them have overlapped.
  const inFlight = useRef(new Map<string, { count: number; overlapped: boolean }>());

  const beginRowSave = useCallback((rowId: GridRow['id']): RowSaveTicket => {
    const id = String(rowId);
    const flight = inFlight.current.get(id);
    if (flight) {
      flight.count += 1;
      flight.overlapped = true;
    } else {
      inFlight.current.set(id, { count: 1, overlapped: false });
    }
    return { n: ++counter.current, id, base: latestRows.current };
  }, []);

  const endRowSave = useCallback((ticket: RowSaveTicket): boolean => {
    const flight = inFlight.current.get(ticket.id);
    if (!flight) return false;
    flight.count -= 1;
    if (flight.count > 0) return false;
    inFlight.current.delete(ticket.id);
    return flight.overlapped;
  }, []);

  const replaceRow = useCallback(
    (row: GridRow, ticket: RowSaveTicket, column: string): RowSaveResult => {
      const { base, n } = ticket;
      if (base !== latestRows.current) return 'outdated';
      const id = String(row.id);
      const landedAt = counter.current;
      setOverrides((prev) => {
        const byId = new Map(prev.base === base ? prev.byId : []);
        const current = byId.get(id);
        const own = new Map<string, OwnColumn>();
        for (const [col, entry] of current?.own ?? []) {
          // This save started after that one landed: its row already includes it.
          if (entry.landedAt >= n) own.set(col, entry);
        }
        own.set(column, { source: row, landedAt });
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

  return { rows, rowById, beginRowSave, endRowSave, replaceRow };
}
