import { CircleAlert, CircleCheck, Info, type LucideIcon, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useBrume } from '../provider';
import { IconButton } from './icon-button';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface ToastOptions {
  /** Same id is shown at most once at a time. */
  id?: string;
}

/** Success, info and warning toasts dismiss themselves after this; errors stay until closed. */
const DURATION_MS = 4000;

let items: ToastItem[] = [];
let autoId = 0;
const listeners = new Set<() => void>();

function emit(next: ToastItem[]) {
  items = next;
  for (const l of listeners) l();
}

function push(kind: ToastKind, message: string, opts?: ToastOptions) {
  const id = opts?.id ?? `br-toast-${++autoId}`;
  if (items.some((t) => t.id === id)) return;
  emit([...items, { id, kind, message }]);
}

function dismiss(id: string) {
  emit(items.filter((t) => t.id !== id));
}

/** Test helper (not exported from the package index): removes every toast. */
export function clearToasts() {
  emit([]);
}

export const toast = {
  success: (msg: string, opts?: ToastOptions) => push('success', msg, opts),
  error: (msg: string, opts?: ToastOptions) => push('error', msg, opts),
  info: (msg: string, opts?: ToastOptions) => push('info', msg, opts),
  warning: (msg: string, opts?: ToastOptions) => push('warning', msg, opts),
};

const KINDS: Record<ToastKind, { icon: LucideIcon; color: string }> = {
  success: { icon: CircleCheck, color: 'br:text-success' },
  error: { icon: CircleAlert, color: 'br:text-danger' },
  info: { icon: Info, color: 'br:text-info' },
  warning: { icon: TriangleAlert, color: 'br:text-warning' },
};

function ToastView({ item }: { item: ToastItem }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Hover or keyboard focus inside the toast pauses the timer (WCAG 2.2.1).
  const paused = hovered || focused;
  const remaining = useRef(DURATION_MS);
  const { t } = useBrume();
  const { icon: Icon, color } = KINDS[item.kind];
  const sticky = item.kind === 'error';

  useEffect(() => {
    if (sticky || paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [sticky, paused, item.id]);

  return (
    <div
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      className="br:pointer-events-auto br:flex br:max-w-sm br:items-start br:gap-3 br:rounded-card br:border br:border-border br:bg-surface br:px-4 br:py-3 br:text-sm br:text-text br:shadow-overlay br:animate-[br-toast-in_160ms_ease-out] br:motion-reduce:animate-none"
    >
      <Icon aria-hidden="true" className={`br:mt-0.5 br:size-5 br:shrink-0 ${color}`} />
      <span className="br:min-w-0 br:flex-1 br:py-0.5">{item.message}</span>
      <IconButton
        icon={X}
        label={t('common.close')}
        onClick={() => dismiss(item.id)}
        className="br:-my-1 br:-mr-2 br:size-8 br:shrink-0"
      />
    </div>
  );
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Mount once at the app root. */
export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
  return (
    <div
      data-brume-toaster=""
      aria-live="polite"
      className="br:pointer-events-none br:fixed br:right-4 br:bottom-4 br:z-[60] br:flex br:flex-col br:gap-2"
    >
      {list.map((item) => (
        <ToastView key={item.id} item={item} />
      ))}
    </div>
  );
}
