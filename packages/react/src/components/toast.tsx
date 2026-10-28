import { CircleAlert, CircleCheck, Info, type LucideIcon, TriangleAlert, X } from 'lucide-react';
import {
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { IconButton } from './icon-button';
import {
  GAP_PX,
  type StackSlot,
  shouldDismiss,
  stackHeight,
  stackLayout,
  swipeOffset,
} from './toast-stack';
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  type ToastItem,
  type ToastKind,
} from './toast-store';

export { clearToasts, type ToastOptions, toast } from './toast-store';

/** Success, info and warning toasts dismiss themselves after this; errors stay until closed. */
const DURATION_MS = 4000;
/** Vertical padding (py-3) + border of a toast; heights are measured on the content box. */
const CHROME_PX = 26;

const KINDS: Record<ToastKind, { icon: LucideIcon; color: string }> = {
  success: { icon: CircleCheck, color: 'br:text-success' },
  error: { icon: CircleAlert, color: 'br:text-danger' },
  info: { icon: Info, color: 'br:text-info' },
  warning: { icon: TriangleAlert, color: 'br:text-warning' },
};

/** Movement on the emphasized curve; opacity on the fade duration (the one kept under reduced motion). */
const MOTION: CSSProperties = {
  transition: [
    'transform var(--br-duration-slow) var(--br-ease-emphasized)',
    'height var(--br-duration-slow) var(--br-ease-emphasized)',
    'opacity var(--br-duration-fade) ease',
  ].join(', '),
};

function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return hidden;
}

/** True one frame after mount, so the enter transition starts from the off-screen state. */
function useEntered(): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  return entered;
}

interface ToastViewProps {
  item: ToastItem;
  slot: StackSlot | null;
  paused: boolean;
  onHeight(key: number, height: number): void;
  onSwipingChange(swiping: boolean): void;
}

function ToastView({ item, slot, paused, onHeight, onSwipingChange }: ToastViewProps) {
  const { t } = useBrume();
  const { icon: Icon, color } = KINDS[item.kind];
  const sticky = item.kind === 'error';
  const removing = item.removing !== undefined;
  const entered = useEntered();
  const remaining = useRef(DURATION_MS);
  const contentRef = useRef<HTMLDivElement>(null);
  // A leaving toast keeps the slot it had, so it fades out where it was.
  const lastSlot = useRef<StackSlot | null>(slot);
  if (slot) lastSlot.current = slot;
  const place = slot ?? lastSlot.current;
  const drag = useRef<{ x: number; at: number; id: number } | null>(null);
  const [dx, setDx] = useState(0);
  const dragging = dx !== 0 && !removing;

  useEffect(() => {
    if (sticky || paused || removing) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [sticky, paused, removing, item.id]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const report = () => onHeight(item.key, el.offsetHeight + CHROME_PX);
    report();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [item.key, onHeight]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (removing || e.button !== 0 || (e.target as Element).closest('button')) return;
    drag.current = { x: e.clientX, at: e.timeStamp, id: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onSwipingChange(true);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    setDx(e.clientX - drag.current.x);
  }
  function endDrag(e: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const start = drag.current;
    if (start?.id !== e.pointerId) return;
    drag.current = null;
    onSwipingChange(false);
    const moved = e.clientX - start.x;
    if (!cancelled && shouldDismiss(moved, e.timeStamp - start.at)) {
      dismissToast(item.id, 'swipe');
    } else {
      setDx(0);
    }
  }

  const visible = place?.visible ?? false;
  const behind = place?.height !== undefined;
  let transform = `translateY(${place?.y ?? 0}px) scale(${place?.scale ?? 1})`;
  let opacity = visible ? 1 : 0;
  if (!entered) {
    transform = 'translateY(100%)';
    opacity = 0;
  } else if (item.removing === 'swipe') {
    transform = `translateX(calc(100% + 24px)) translateY(${place?.y ?? 0}px)`;
    opacity = 0;
  } else if (removing) {
    transform = `translateY(${place?.y ?? 0}px) scale(${(place?.scale ?? 1) * 0.96})`;
    opacity = 0;
  } else if (dx !== 0) {
    transform = `translateX(${swipeOffset(dx)}px) ${transform}`;
    opacity = Math.max(0.4, 1 - Math.max(dx, 0) / 200);
  }

  return (
    <div
      role="status"
      aria-hidden={removing || undefined}
      inert={removing || !visible || undefined}
      data-front={place?.front || undefined}
      data-removing={item.removing}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, false)}
      onPointerCancel={(e) => endDrag(e, true)}
      style={{
        ...MOTION,
        ...(dragging ? { transition: 'none' } : null),
        transform,
        opacity,
        height: behind ? Math.max(0, (place?.height ?? 0) - CHROME_PX) : undefined,
      }}
      className={cn(
        'br:absolute br:right-0 br:bottom-0 br:box-content br:flex br:w-[calc(100%-34px)] br:origin-top br:touch-pan-y br:items-start br:gap-3 br:overflow-hidden br:rounded-card br:border br:border-border br:bg-surface br:px-4 br:py-3 br:text-sm br:text-text br:shadow-overlay br:select-none',
        visible && !removing ? 'br:pointer-events-auto' : 'br:pointer-events-none',
        // Fills the gap above an expanded toast so moving between toasts keeps the stack open.
        'br:before:absolute br:before:inset-x-0 br:before:bottom-full br:before:h-[var(--br-toast-gap,0px)] br:before:content-[""]',
      )}
    >
      <div
        ref={contentRef}
        className={cn(
          'br:flex br:min-w-0 br:flex-1 br:items-start br:gap-3 br:transition-opacity br:duration-fade',
          behind && 'br:opacity-0',
        )}
      >
        <Icon aria-hidden="true" className={`br:mt-0.5 br:size-5 br:shrink-0 ${color}`} />
        <span className="br:min-w-0 br:flex-1 br:py-0.5 br:select-text">{item.message}</span>
        <IconButton
          icon={X}
          label={t('common.close')}
          onClick={() => dismissToast(item.id)}
          className="br:-my-1 br:-mr-2 br:size-8 br:shrink-0"
        />
      </div>
    </div>
  );
}

/**
 * Mount once at the app root. Toasts stack at the bottom-right: collapsed with depth, expanded
 * while hovered or focused (timers pause then, and in a hidden tab), swipe right to dismiss.
 */
export function Toaster() {
  const list = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const docHidden = useDocumentHidden();

  const live = list.filter((t) => !t.removing).reverse();
  const expanded = (hovered || focusWithin || swiping) && live.length > 0;
  const paused = expanded || docHidden;
  const liveHeights = live.map((t) => heights[t.key] ?? 0);
  const slots = stackLayout(liveHeights, expanded);
  const slotByKey = new Map(live.map((t, i) => [t.key, slots[i] ?? null]));

  const onHeight = useCallback((key: number, height: number) => {
    setHeights((prev) => (prev[key] === height ? prev : { ...prev, [key]: height }));
  }, []);

  useEffect(() => {
    if (list.length === 0) {
      setHovered(false);
      setSwiping(false);
      setHeights({});
    }
  }, [list.length]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover/focus only expand the stack and pause timers; every action is a real button
    <div
      data-brume-toaster=""
      data-expanded={expanded || undefined}
      aria-live="polite"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      style={
        {
          height: stackHeight(liveHeights, expanded),
          '--br-toast-gap': expanded ? `${GAP_PX}px` : '0px',
          transition: 'height var(--br-duration-slow) var(--br-ease-emphasized)',
        } as CSSProperties
      }
      className="br:pointer-events-none br:fixed br:right-4 br:bottom-4 br:z-[60] br:w-[356px] br:max-w-[calc(100vw-32px)]"
    >
      {list.map((item) => (
        <ToastView
          key={item.key}
          item={item}
          slot={slotByKey.get(item.key) ?? null}
          paused={paused}
          onHeight={onHeight}
          onSwipingChange={setSwiping}
        />
      ))}
    </div>
  );
}
