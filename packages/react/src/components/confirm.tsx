import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import { cn } from '../cn';
import { MODAL_MOTION, OVERLAY_MOTION } from '../motion/classes';
import { useBrume } from '../provider';
import { Button } from './button';

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Required: name the concrete action ("刪除項目"), never "確定". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface Request {
  id: number;
  opts: ConfirmOptions;
  resolve(value: boolean): void;
}

let queue: Request[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function emit(next: Request[]) {
  queue = next;
  for (const l of listeners) l();
}

function ask(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => emit([...queue, { id: ++nextId, opts, resolve }]));
}

/** Idempotent per request: only acts while `req` is still the head of the queue. */
function settle(req: Request, value: boolean) {
  const [head, ...rest] = queue;
  if (head !== req) return;
  emit(rest);
  head.resolve(value);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Returns a stable function that opens a confirmation and resolves true (confirmed) or false. */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  return useCallback((opts) => ask(opts), []);
}

/** Mount once at the app root, inside BrumeProvider. */
export function ConfirmHost() {
  const { t } = useBrume();
  const current = useSyncExternalStore(
    subscribe,
    () => queue[0],
    () => undefined,
  );
  const contentRef = useRef<HTMLDivElement>(null);
  // The last request stays rendered (closed) so the dialog can play its exit animation.
  const lastRef = useRef<Request | undefined>(undefined);
  if (current) lastRef.current = current;
  const shown = current ?? lastRef.current;
  if (!shown) return null;
  const { opts } = shown;
  const danger = opts.tone === 'danger';

  return (
    <AlertDialog.Root
      key={shown.id}
      open={shown === current}
      onOpenChange={(open) => !open && settle(shown, false)}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className={cn('br:fixed br:inset-0 br:z-[70] br:bg-scrim/40', OVERLAY_MOTION)}
        />
        <AlertDialog.Content
          ref={contentRef}
          onOpenAutoFocus={(e) => {
            // Radix focuses Cancel by default; non-destructive confirms start on the action.
            const action = contentRef.current?.querySelector<HTMLElement>('[data-confirm-action]');
            if (!danger && action) {
              e.preventDefault();
              action.focus();
            }
          }}
          className={cn(
            'br:fixed br:top-1/2 br:left-1/2 br:z-[70] br:w-[420px] br:max-w-[calc(100vw-48px)] br:-translate-x-1/2 br:-translate-y-1/2 br:rounded-dialog br:border br:border-border br:bg-surface br:p-6 br:text-text br:shadow-overlay',
            MODAL_MOTION,
          )}
        >
          <AlertDialog.Title className="br:text-lg br:font-semibold">
            {opts.title}
          </AlertDialog.Title>
          {opts.description ? (
            <AlertDialog.Description className="br:mt-2 br:text-sm br:text-text-muted">
              {opts.description}
            </AlertDialog.Description>
          ) : (
            <AlertDialog.Description className="br:sr-only">{opts.title}</AlertDialog.Description>
          )}
          <div className="br:mt-6 br:flex br:justify-end br:gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">{opts.cancelLabel ?? t('common.cancel')}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                data-confirm-action=""
                variant={danger ? 'danger' : 'primary'}
                onClick={() => settle(shown, true)}
              >
                {opts.confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
