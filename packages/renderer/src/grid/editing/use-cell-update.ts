import { toast, useBrume } from '@brume-ui/brume-react';
import type { CellUpdateResponse, ErrorResponse, GridRow } from '@brume-ui/brume-schema';
import { useCallback, useMemo, useRef, useState } from 'react';
import { applyFeedback } from '../actions/feedback';
import { failureMessage } from '../actions/run-action';
import { useGrid } from '../grid-context';
import { useGridNavigation } from '../use-grid-navigation';

/** The value an editor starts from: `_meta.raw[column]` when the server sent one, else the cell. */
export function editValue(row: GridRow, column: string): unknown {
  const raw = row._meta?.raw;
  return raw && column in raw ? raw[column] : row[column];
}

export interface CellUpdate {
  /** What the cell holds now: the newest pending value, else the last confirmed one. */
  value: unknown;
  /** A save of the value shown is in flight. */
  pending: boolean;
  /** The validation error (422) of the last save, until a later save succeeds. */
  error: string | null;
  /**
   * Saves `next` (PATCH `endpoints.cell`) and shows `shown` (default `next`) until it settles.
   * Every call gets a higher number: a response older than one already applied is ignored, a
   * failure only reverts when it is the newest call, and a revert goes back to the last value the
   * server confirmed (the row).
   */
  commit(next: unknown, shown?: unknown): Promise<void>;
  /** False without `endpoints.cell`: the cell cannot be saved. */
  canSave: boolean;
}

/** Optimistic saving of one cell (`column` of the row with `rowId`). */
export function useCellUpdate(rowId: GridRow['id'], column: string): CellUpdate {
  const { adapter, t } = useBrume();
  const { refresh } = useGridNavigation();
  const { page, rows, replaceRow } = useGrid();
  const endpoint = page.endpoints?.cell;
  const row = rows.find((r) => String(r.id) === String(rowId));
  const confirmed = row ? editValue(row, column) : undefined;

  const [optimistic, setOptimistic] = useState<{ seq: number; value: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const issued = useRef(0);
  const applied = useRef(0);

  const commit = useCallback(
    async (next: unknown, shown: unknown = next) => {
      if (!endpoint) return;
      const seq = ++issued.current;
      setOptimistic({ seq, value: shown });
      const res = await adapter.request<Partial<CellUpdateResponse & ErrorResponse>>({
        method: 'patch',
        url: endpoint.replaceAll('{id}', encodeURIComponent(String(rowId))),
        body: { column, value: next },
      });
      const newest = seq === issued.current;
      if (res.status >= 200 && res.status < 300) {
        if (seq > applied.current) {
          applied.current = seq;
          if (res.data?.row) replaceRow(res.data.row);
          if (res.data?.feedback) applyFeedback(res.data.feedback, { adapter, refresh });
        }
        if (newest) {
          setOptimistic(null);
          setError(null);
        }
        return;
      }
      // A failed call that a newer one replaced has nothing on screen to revert.
      if (!newest) return;
      setOptimistic(null);
      const fieldError = res.status === 422 ? res.data?.errors?.[column]?.[0] : undefined;
      if (fieldError) {
        setError(fieldError);
      } else {
        toast.error(failureMessage(res, t));
      }
    },
    [adapter, t, refresh, endpoint, rowId, column, replaceRow],
  );

  return useMemo(
    () => ({
      value: optimistic ? optimistic.value : confirmed,
      pending: optimistic !== null,
      error,
      commit,
      canSave: Boolean(endpoint),
    }),
    [optimistic, confirmed, error, commit, endpoint],
  );
}
