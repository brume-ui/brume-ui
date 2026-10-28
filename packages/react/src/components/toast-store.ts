/** Module-level toast store: `toast.*()` can be called from anywhere, `<Toaster>` renders it. */

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  /** Public id (dedupe key). */
  id: string;
  /** Internal render key: an id can come back while its previous toast is still leaving. */
  key: number;
  kind: ToastKind;
  message: string;
  /** Set while the exit animation plays; the toast is already gone for assistive tech. */
  removing?: 'close' | 'swipe';
}

export interface ToastOptions {
  /** Same id is shown at most once at a time. */
  id?: string;
}

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
  emit([...items, { id, key: ++nextKey, kind, message }]);
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
};
