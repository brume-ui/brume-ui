import { failureMessage, type HttpResponse, toast, useBrume } from '@brume-ui/brume-react';
import type {
  ListPage,
  ReorderItemsResponse,
  ReorderListRequest,
  ReorderMoveRequest,
  ReorderResponse,
} from '@brume-ui/brume-schema';
import { useCallback, useMemo } from 'react';
import { applyFeedback } from '../actions/feedback';
import { useGridNavigation } from '../use-grid-navigation';

export interface Reorder {
  /** Posts one move (list mode: `before`/`after`; tree mode also `parent`), then reloads the grid. */
  move(m: ReorderMoveRequest): Promise<void>;
  /** GETs every orderable item. Throws an Error with a user-facing message on failure. */
  loadItems(): Promise<ReorderItemsResponse>;
  /** Posts the full order, then reloads the grid. Throws an Error with a user-facing message on failure. */
  saveList(ids: ReorderListRequest['ids']): Promise<void>;
}

const ok = (res: HttpResponse) => res.status >= 200 && res.status < 300;

/** Reordering through `endpoints.reorder`; every outcome ends in a grid reload. */
export function useReorder(page: ListPage): Reorder {
  const { adapter, t } = useBrume();
  const { refresh } = useGridNavigation();
  const endpoint = page.endpoints?.reorder;

  const post = useCallback(
    async (
      body: ReorderMoveRequest | ReorderListRequest,
    ): Promise<HttpResponse<ReorderResponse>> => {
      if (!endpoint) return { status: 0, data: {} };
      try {
        return await adapter.request<ReorderResponse>({ method: 'post', url: endpoint, body });
      } catch (error) {
        // Adapters resolve every outcome; one that throws anyway counts as a network error.
        return {
          status: 0,
          data: { message: error instanceof Error ? error.message : '' } as never,
        };
      }
    },
    [adapter, endpoint],
  );

  return useMemo<Reorder>(() => {
    const undo = async (move: ReorderMoveRequest) => {
      const res = await post(move);
      if (ok(res)) toast.success(t('grid.reorderUndone'));
      else toast.error(failureMessage(res, t));
      refresh();
    };
    return {
      async move(m) {
        const res = await post(m);
        if (!ok(res)) {
          // The optimistic order is wrong now: the server's rows replace it.
          toast.error(failureMessage(res, t));
          refresh();
          return;
        }
        const back = res.data?.undo;
        toast.success(
          t('grid.reordered'),
          back
            ? { action: { label: t('grid.reorderUndo'), onClick: () => void undo(back) } }
            : undefined,
        );
        const feedback = res.data?.feedback;
        if (feedback) applyFeedback(feedback, { adapter, refresh });
        if (!feedback?.refresh && !feedback?.redirect) refresh();
      },
      async loadItems() {
        if (!endpoint) throw new Error(t('action.failedUnknown'));
        let res: HttpResponse<ReorderItemsResponse>;
        try {
          res = await adapter.request<ReorderItemsResponse>({ method: 'get', url: endpoint });
        } catch {
          res = { status: 0, data: { items: [] } };
        }
        if (!ok(res)) throw new Error(failureMessage(res, t));
        return res.data;
      },
      async saveList(ids) {
        const res = await post({ ids });
        if (!ok(res)) throw new Error(failureMessage(res, t));
        // No undo for a whole-list save.
        toast.success(t('grid.reordered'));
        const feedback = res.data?.feedback;
        if (feedback) applyFeedback(feedback, { adapter, refresh });
        if (!feedback?.refresh && !feedback?.redirect) refresh();
      },
    };
  }, [adapter, endpoint, post, refresh, t]);
}
