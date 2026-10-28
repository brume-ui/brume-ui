import {
  type BrumeAdapter,
  type ConfirmOptions,
  errorMessage,
  type HttpResponse,
  toast,
  useBrume,
  useConfirm,
} from '@brume-ui/brume-react';
import type { ActionDef, ActionRequest, ActionResponse, ListPage } from '@brume-ui/brume-schema';
import { useCallback, useMemo } from 'react';
import { useGrid } from '../grid-context';
import { useGridNavigation } from '../use-grid-navigation';
import { applyFeedback } from './feedback';

type Translate = ReturnType<typeof useBrume>['t'];

export interface RunActionDeps {
  adapter: BrumeAdapter;
  t: Translate;
  confirm(opts: ConfirmOptions): Promise<boolean>;
  refresh(): void;
  /** `page.endpoints.action`, with its `{action}` placeholder. */
  endpoint: string;
  /**
   * Called once the request is about to go out (after any confirmation). Returning false stops
   * it (the same run is already in flight).
   */
  onRequest?(): boolean | undefined;
}

/** The action endpoint of `page` for `key`, or undefined when the page has none. */
export function actionUrl(page: ListPage, key: string): string | undefined {
  return page.endpoints?.action?.replaceAll('{action}', encodeURIComponent(key));
}

/** `{count}` in a confirm text is the number of rows the action runs on (batch confirms). */
function withCount(text: string, count: number): string {
  return text.replaceAll('{count}', String(count));
}

/** Network, expired and signed-out errors say it all; anything else names the failed action. */
function failureMessage(res: HttpResponse, t: Translate): string {
  const message = errorMessage(res, t);
  if (res.status === 0 || res.status === 401 || res.status === 419) return message;
  return message ? t('action.failed', { message }) : t('action.failedUnknown');
}

/**
 * Asks for confirmation when the action has one, then posts the request. A 2xx plays the
 * feedback (the server's default when it sends none); anything else is an error toast.
 * Resolves true only when the action ran.
 */
export async function runAction(
  def: ActionDef,
  req: ActionRequest,
  deps: RunActionDeps,
): Promise<boolean> {
  if (def.confirm) {
    const count = req.ids.length;
    const ok = await deps.confirm({
      title: withCount(def.confirm.title, count),
      description: def.confirm.description && withCount(def.confirm.description, count),
      confirmLabel: withCount(def.confirm.confirmLabel, count),
      tone: def.tone === 'danger' ? 'danger' : 'default',
    });
    if (!ok) return false;
  }
  if (deps.onRequest?.() === false) return false;
  const res = await deps.adapter.request<Partial<ActionResponse>>({
    method: 'post',
    url: deps.endpoint.replaceAll('{action}', encodeURIComponent(def.key)),
    body: req,
  });
  if (res.status < 200 || res.status >= 300) {
    toast.error(failureMessage(res, deps.t));
    return false;
  }
  applyFeedback(
    res.data?.feedback ?? {
      toast: { type: 'success', message: deps.t('action.done', { label: def.label }) },
      refresh: true,
    },
    deps,
  );
  return true;
}

/**
 * `run(def, target, ids)` for the grid in context, plus `isRunning(def, target, ids)` so its
 * buttons and menu items can show a spinner and not be pressed twice. The runs in flight live in
 * the grid, so every runner of a row (buttons, ⋯, right-click menu) shares them, and a run that is
 * already in flight is not sent again. `run` is undefined without an endpoint.
 */
export function useActionRunner(): {
  run?(
    def: ActionDef,
    target: ActionRequest['target'],
    ids: ActionRequest['ids'],
  ): Promise<boolean>;
  isRunning(def: ActionDef, target: ActionRequest['target'], ids: ActionRequest['ids']): boolean;
} {
  const { adapter, t } = useBrume();
  const confirm = useConfirm();
  const { refresh } = useGridNavigation();
  const { page, runningActions, startAction, endAction } = useGrid();
  const endpoint = page.endpoints?.action;

  const run = useCallback(
    async (def: ActionDef, target: ActionRequest['target'], ids: ActionRequest['ids']) => {
      if (!endpoint) return false;
      const key = runKey(def, target, ids);
      let started = false;
      const onRequest = () => {
        started = startAction(key);
        return started;
      };
      try {
        return await runAction(
          def,
          { target, ids },
          { adapter, t, confirm, refresh, endpoint, onRequest },
        );
      } finally {
        if (started) endAction(key);
      }
    },
    [adapter, t, confirm, refresh, endpoint, startAction, endAction],
  );
  const isRunning = useCallback(
    (def: ActionDef, target: ActionRequest['target'], ids: ActionRequest['ids']) =>
      runningActions.has(runKey(def, target, ids)),
    [runningActions],
  );
  return useMemo(
    () => ({ run: endpoint ? run : undefined, isRunning }),
    [endpoint, run, isRunning],
  );
}

/** Identifies one run of an action on some rows (for `pending`). */
export function runKey(
  def: ActionDef,
  target: ActionRequest['target'],
  ids: ActionRequest['ids'],
): string {
  return `${target}\u0000${def.key}\u0000${ids.join('\u0000')}`;
}
