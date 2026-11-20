/** Module-level toast store: `toast.*()` can be called from anywhere, `<Toaster>` renders it. */

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  /** Public id (dedupe key). */
  id: string;
  /** Internal render key: an id can come back while its previous toast is still leaving. */
  key: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  /** ms before it dismisses itself; undefined = the kind's default (errors stay). */
  duration?: number;
  /** Set while the exit animation plays; the toast is already gone for assistive tech. */
  removing?: 'close' | 'swipe';
}

export interface ToastAction {
  label: string;
  onClick(): void;
}

export interface ToastOptions {
  /** Same id is shown at most once at a time. */
  id?: string;
  /** A button shown in the toast; running it also closes the toast. */
  action?: ToastAction;
  /** ms before it closes itself. With an action the default is 6000. */
  duration?: number;
}

/** Long enough to reach for the action button. */
const ACTION_DURATION_MS = 6000;

/** How long a removed toast stays in the DOM for its exit animation (≈ --br-duration-base). */
export const EXIT_MS = 200;

let items: ToastItem[] = [];
let autoId = 0;
let nextKey = 0;
const listeners = new Set<() => void>();
const exitTimers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(next: ToastItem[]) {
  items = next;
  for (const l of listeners) l();
}

export function getToasts(): ToastItem[] {
  return items;
}

export function subscribeToasts(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function push(kind: ToastKind, message: string, opts?: ToastOptions) {
  const id = opts?.id ?? `br-toast-${++autoId}`;
  if (items.some((t) => t.id === id && !t.removing)) return;
  const action = opts?.action;
  const duration = opts?.duration ?? (action ? ACTION_DURATION_MS : undefined);
  emit([...items, { id, key: ++nextKey, kind, message, action, duration }]);
}

/** Starts the exit of the live toast with `id`; it leaves the DOM after EXIT_MS. */
export function dismissToast(id: string, how: 'close' | 'swipe' = 'close') {
  const target = items.find((t) => t.id === id && !t.removing);
  if (!target) return;
  emit(items.map((t) => (t === target ? { ...t, removing: how } : t)));
  exitTimers.set(
    target.key,
    setTimeout(() => {
      exitTimers.delete(target.key);
      emit(items.filter((t) => t.key !== target.key));
    }, EXIT_MS),
  );
}

/** Test helper (not exported from the package index): removes every toast at once. */
export function clearToasts() {
  for (const timer of exitTimers.values()) clearTimeout(timer);
  exitTimers.clear();
  emit([]);
}

export const toast = {
  success: (msg: string, opts?: ToastOptions) => push('success', msg, opts),
  error: (msg: string, opts?: ToastOptions) => push('error', msg, opts),
  info: (msg: string, opts?: ToastOptions) => push('info', msg, opts),
  warning: (msg: string, opts?: ToastOptions) => push('warning', msg, opts),
  /** Closes the toast showing with this id (no-op if none), so the id is free for a new one. */
  dismiss: (id: string) => dismissToast(id),
};
