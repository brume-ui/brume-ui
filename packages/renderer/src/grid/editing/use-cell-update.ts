import { type HttpResponse, toast, useBrume } from '@brume-ui/brume-react';
import type { CellUpdateResponse, ErrorResponse, GridRow } from '@brume-ui/brume-schema';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { applyFeedback } from '../actions/feedback';
import { failureMessage } from '../actions/run-action';
import { useGrid } from '../grid-context';
import { useGridNavigation } from '../use-grid-navigation';
import type { RowSaveTicket } from './row-saves';

function sameValue(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
}

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
  const { page, rowById, beginRowSave, endRowSave, replaceRow } = useGrid();
  const endpoint = page.endpoints?.cell;
  const row = rowById.get(String(rowId));
  const confirmed = row ? editValue(row, column) : undefined;
  const pageRows = useRef(page.rows);
  useLayoutEffect(() => {
    pageRows.current = page.rows;
  }, [page.rows]);

  // `heldOn`: the save succeeded after `page.rows` changed, so its row could not be used; the
  // value stays on screen until the refresh that brings the server's rows arrives.
  const [optimistic, setOptimistic] = useState<{
    seq: number;
    value: unknown;
    heldOn?: GridRow[];
  } | null>(null);
  // `at`: the confirmed value the error was about; new rows with another value make it stale.
  const [error, setError] = useState<{ message: string; at: unknown } | null>(null);
  const confirmedRef = useRef(confirmed);
  useLayoutEffect(() => {
    confirmedRef.current = confirmed;
  }, [confirmed]);
  const issued = useRef(0);
  const applied = useRef(0);

  const commit = useCallback(
    async (next: unknown, shown: unknown = next) => {
      if (!endpoint) return;
      /** Applies one response; true when it already refreshes the page (or leaves it). */
      function settle(
        seq: number,
        res: HttpResponse<Partial<CellUpdateResponse & ErrorResponse>>,
        ticket: RowSaveTicket,
        shown: unknown,
      ): boolean {
        const newest = seq === issued.current;
        if (res.status >= 200 && res.status < 300) {
          let outdated = false;
          let refreshed = false;
          if (seq > applied.current) {
            applied.current = seq;
            const returned = res.data?.row;
            outdated = returned ? replaceRow(returned, ticket, column) === 'outdated' : false;
            // Rows that changed under the save may predate it: let the server's rows decide.
            const feedback = outdated
              ? { ...res.data?.feedback, refresh: true }
              : res.data?.feedback;
            if (feedback) {
              applyFeedback(feedback, { adapter, refresh });
              refreshed = Boolean(feedback.refresh || feedback.redirect);
            }
          }
          if (newest) {
            setOptimistic(outdated ? { seq, value: shown, heldOn: pageRows.current } : null);
            setError(null);
          }
          return refreshed;
        }
        // A failed call that a newer one replaced has nothing on screen to revert.
        if (!newest) return false;
        setOptimistic(null);
        const fieldError = res.status === 422 ? res.data?.errors?.[column]?.[0] : undefined;
        if (fieldError) {
          setError({ message: fieldError, at: confirmedRef.current });
        } else {
          toast.error(failureMessage(res, t));
        }
        return false;
      }

      const seq = ++issued.current;
      const ticket = beginRowSave(rowId);
      setOptimistic({ seq, value: shown });
      let refreshed = false;
      try {
        let res: HttpResponse<Partial<CellUpdateResponse & ErrorResponse>>;
        try {
          res = await adapter.request<Partial<CellUpdateResponse & ErrorResponse>>({
            method: 'patch',
            url: endpoint.replaceAll('{id}', encodeURIComponent(String(rowId))),
            body: { column, value: next },
          });
        } catch (error) {
          // Adapters resolve every outcome; one that throws anyway counts as a network error.
          res = { status: 0, data: { message: error instanceof Error ? error.message : '' } };
        }
        refreshed = settle(seq, res, ticket, shown);
      } finally {
        // Saves of this row overlapped: only the server knows the order it ran them in, so once
        // the last one settles its rows decide (unless this response already refreshes or leaves).
        if (endRowSave(ticket) && !refreshed) refresh();
      }
    },
    [adapter, t, refresh, endpoint, rowId, column, beginRowSave, endRowSave, replaceRow],
  );

  const showing = optimistic && (!optimistic.heldOn || optimistic.heldOn === page.rows);
  // By content: rows bring new arrays and objects even when the value is the same.
  const visibleError = error && sameValue(error.at, confirmed) ? error.message : null;
  return useMemo(
    () => ({
      value: showing ? optimistic.value : confirmed,
      pending: Boolean(showing && !optimistic.heldOn),
      error: visibleError,
      commit,
      canSave: Boolean(endpoint),
    }),
    [showing, optimistic, confirmed, visibleError, commit, endpoint],
  );
}
