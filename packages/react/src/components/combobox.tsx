import type { OptionItem } from '@brume-ui/brume-schema';
import * as RadixPopover from '@radix-ui/react-popover';
import { Check, ChevronDown, X } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '../cn';
import { HighlightIndicator, useHighlightIndicator } from '../motion/highlight';
import { useBrume } from '../provider';
import { Chip } from './chip';
import { CONTROL_BORDER, CONTROL_SKIN, HIGHLIGHT_RING } from './focus';
import { IconButton } from './icon-button';
import { POPOVER_SURFACE } from './popover';

export type ComboboxLoader = (args: {
  q: string;
  page: number;
}) => Promise<{ options: OptionItem[]; hasMore: boolean }>;

export interface ComboboxProps {
  multiple?: boolean;
  /** A value, or the values when `multiple`. */
  value: string | string[];
  onChange(value: string | string[]): void;
  /** Local options, filtered by the typed text. */
  options?: OptionItem[];
  /** Remote mode: loads page 1 after a 250ms typing pause, the next page at the list's end. */
  load?: ComboboxLoader;
  /** Labels of selected values that are not among the loaded options (remote mode). */
  resolveLabels?(values: string[]): Promise<OptionItem[]>;
  placeholder?: string;
  /** Accessible name of the field and its list. */
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}

const REMOTE_DEBOUNCE_MS = 250;
/** Distance from the list's bottom (px) at which the next remote page loads. */
const LOAD_MORE_THRESHOLD = 24;

const matches = (o: OptionItem, q: string) => o.label.toLowerCase().includes(q.toLowerCase());

/**
 * Searchable select (WAI-ARIA 1.2 combobox with a listbox popup). Focus stays in the input; the
 * active option is announced through `aria-activedescendant`. With `load` it searches remotely,
 * keeping only the newest request's result. `multiple` shows the selection as chips; Backspace in
 * the empty input removes the last one.
 */
export function Combobox({
  multiple = false,
  value,
  onChange,
  options,
  load,
  resolveLabels,
  placeholder,
  label,
  invalid,
  disabled,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
}: ComboboxProps) {
  const { t } = useBrume();
  const autoId = useId();
  const inputId = id ?? autoId;
  const listboxId = `${inputId}-listbox`;
  const optionId = (i: number) => `${inputId}-option-${i}`;
  const isInvalid = Boolean(invalid) || ariaInvalid === true || ariaInvalid === 'true';

  const values = Array.isArray(value) ? value : value === '' ? [] : [value];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  /** Single mode: the input shows the typed text instead of the selected label. */
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(-1);
  /** True between compositionstart and compositionend: the text is not committed, so no request. */
  const [composing, setComposing] = useState(false);

  // Labels of every option seen (local, loaded, resolved), so selections keep their label.
  const [known, setKnown] = useState<ReadonlyMap<string, OptionItem>>(() => new Map());
  const remember = useCallback((items: OptionItem[]) => {
    if (items.length === 0) return;
    setKnown((prev) => {
      const next = new Map(prev);
      for (const o of items) next.set(o.value, o);
      return next;
    });
  }, []);
  const labelOf = (v: string) =>
    known.get(v)?.label ?? options?.find((o) => o.value === v)?.label ?? v;

  // Remote state. `latest` numbers requests; only the newest one may write results.
  const [remote, setRemote] = useState<{ items: OptionItem[]; page: number; hasMore: boolean }>({
    items: [],
    page: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(false);
  /** The request that failed, so 「重試」 (or ↓) asks for the same page again. */
  const [failure, setFailure] = useState<{ q: string; page: number } | null>(null);
  const latest = useRef(0);
  /** Set synchronously when a request starts: several scroll events in one frame start one load. */
  const inFlight = useRef(false);
  const loadedFor = useRef<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const fetchPage = useCallback(
    async (q: string, page: number) => {
      const loader = loadRef.current;
      if (!loader) return;
      const request = ++latest.current;
      inFlight.current = true;
      setLoading(true);
      setFailure(null);
      try {
        const res = await loader({ q, page });
        if (request !== latest.current) return;
        remember(res.options);
        setRemote((prev) => ({
          items: page === 1 ? res.options : [...prev.items, ...res.options],
          page,
          hasMore: res.hasMore,
        }));
      } catch {
        if (request !== latest.current) return;
        setFailure({ q, page });
      } finally {
        if (request === latest.current) {
          inFlight.current = false;
          setLoading(false);
        }
      }
    },
    [remember],
  );

  const remoteMode = load !== undefined;
  useEffect(() => {
    if (!remoteMode || !open || composing || loadedFor.current === query) return;
    const timer = setTimeout(() => {
      loadedFor.current = query;
      setActive(-1);
      void fetchPage(query, 1);
    }, REMOTE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [remoteMode, open, composing, query, fetchPage]);

  const loadMore = () => {
    if (!remoteMode || inFlight.current || failure) return;
    if (!remote.hasMore || loadedFor.current === null) return;
    void fetchPage(loadedFor.current, remote.page + 1);
  };

  const retry = () => {
    if (failure && !inFlight.current) void fetchPage(failure.q, failure.page);
  };

  /** Forget remote results and drop any in-flight answer, so a reopened list never shows stale options. */
  const resetRemote = () => {
    if (!remoteMode) return;
    latest.current++;
    inFlight.current = false;
    loadedFor.current = null;
    setLoading(false);
    setFailure(null);
    setRemote({ items: [], page: 0, hasMore: false });
  };

  // Ask once for labels of selected values nobody has described yet.
  const asked = useRef(new Set<string>());
  const valuesKey = values.join('\u0000');
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the selected values.
  useEffect(() => {
    if (!resolveLabels) return;
    const missing = values.filter(
      (v) => !known.has(v) && !options?.some((o) => o.value === v) && !asked.current.has(v),
    );
    if (missing.length === 0) return;
    for (const v of missing) asked.current.add(v);
    resolveLabels(missing).then(remember, () => {
      for (const v of missing) asked.current.delete(v);
    });
  }, [valuesKey]);

  const visible = remoteMode ? remote.items : (options ?? []).filter((o) => matches(o, query));

  const close = () => {
    setOpen(false);
    setActive(-1);
    setEditing(false);
    setQuery('');
    resetRemote();
  };

  const choose = (o: OptionItem) => {
    if (o.disabled) return;
    if (multiple) {
      const next = values.includes(o.value)
        ? values.filter((v) => v !== o.value)
        : [...values, o.value];
      onChange(next);
      setQuery('');
      return;
    }
    onChange(o.value);
    close();
  };

  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  const listRef = useRef<HTMLDivElement | null>(null);
  const highlight = useHighlightIndicator();
  const setListRef = (node: HTMLDivElement | null) => {
    listRef.current = node;
    highlight.ref(node);
  };
  // Keep the keyboard's option in view; only when it changes, so wheel scrolling is not undone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: optionId is derived from a stable id.
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const move = (delta: 1 | -1) => {
    const last = visible.length - 1;
    if (!open) {
      // Down opens on the first option, Up on the last (APG).
      setOpen(true);
      setActive(last < 0 ? -1 : delta === 1 ? 0 : last);
      return;
    }
    if (delta === 1 && active >= last) {
      // Past the end: the keyboard's 載入更多, or 重試 after a failed load.
      if (failure) retry();
      else loadMore();
      return;
    }
    if (last < 0) return;
    setActive((i) => Math.max(0, Math.min(last, i + delta)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // keyCode 229: Safari sends the IME's committing Enter after compositionend.
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
      case 'End':
        if (!open || visible.length === 0) return; // closed: the caret moves as usual
        e.preventDefault();
        setActive(e.key === 'Home' ? 0 : visible.length - 1);
        break;
      case 'Enter': {
        const o = open ? visible[active] : undefined;
        if (!o) {
          if (open && failure) {
            e.preventDefault();
            retry();
          }
          return;
        }
        e.preventDefault();
        choose(o);
        break;
      }
      case 'Escape':
        if (!open && !editing) return;
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case 'Tab':
        if (open) close();
        break;
      case 'Backspace': {
        const last = values.at(-1);
        if (multiple && query === '' && last !== undefined) {
          e.preventDefault();
          remove(last);
        }
        break;
      }
    }
  };

  const selectedLabel = !multiple && values[0] !== undefined ? labelOf(values[0]) : '';
  // A remote query typed but not loaded yet counts as loading (no 「沒有符合的選項」 flash).
  const pending = loading || (remoteMode && open && !composing && loadedFor.current !== query);
  const status = pending
    ? t('common.loading')
    : failure
      ? t('combobox.loadFailed')
      : visible.length === 0
        ? t('combobox.empty')
        : '';

  return (
    <RadixPopover.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <RadixPopover.Anchor asChild>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer convenience; the input owns keyboard and semantics. */}
        <div
          data-state={open ? 'open' : 'closed'}
          aria-disabled={disabled || undefined}
          onMouseDown={(e) => {
            // A press on the chrome around the input (padding, chevron) focuses the input and toggles.
            const target = e.target as HTMLElement;
            if (disabled || target.closest('input,button')) return;
            e.preventDefault();
            document.getElementById(inputId)?.focus();
            if (open) close();
            else setOpen(true);
          }}
          className={cn(
            CONTROL_SKIN,
            'br:group br:flex br:h-auto br:min-h-10 br:w-full br:cursor-text br:flex-wrap br:items-center br:gap-1 br:rounded-input br:py-1 br:pr-2 br:pl-1.5',
            isInvalid ? 'br:border-danger' : CONTROL_BORDER,
            !isInvalid && 'br:hover:border-text-muted',
            'br:outline-none br:has-[input:focus-visible]:outline-solid br:has-[input:focus-visible]:outline-2 br:has-[input:focus-visible]:outline-offset-2 br:has-[input:focus-visible]:outline-focus-ring',
            disabled && 'br:cursor-not-allowed br:opacity-50',
          )}
        >
          {multiple
            ? values.map((v) => (
                <Chip
                  key={v}
                  value={labelOf(v)}
                  removeLabel={t('combobox.remove', { label: labelOf(v) })}
                  onRemove={() => remove(v)}
                />
              ))
            : null}
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            aria-invalid={isInvalid || undefined}
            aria-describedby={describedBy}
            autoComplete="off"
            disabled={disabled}
            placeholder={multiple && values.length > 0 ? undefined : placeholder}
            value={multiple || editing ? query : selectedLabel}
            onChange={(e) => {
              setQuery(e.target.value);
              setEditing(true);
              setActive(-1);
              setOpen(true);
            }}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setComposing(false);
              setQuery(e.currentTarget.value);
            }}
            onClick={() => setOpen(true)}
            // Single mode: typing replaces the shown label instead of appending to it.
            onFocus={(e) => !multiple && e.currentTarget.select()}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (open) close();
              else setEditing(false);
            }}
            className="br:h-8 br:min-w-[6ch] br:flex-1 br:bg-transparent br:px-1.5 br:text-sm br:text-text br:outline-none br:placeholder:text-text-muted br:disabled:cursor-not-allowed"
          />
          {!multiple && values.length > 0 && !disabled ? (
            <IconButton
              icon={X}
              label={t('combobox.clear')}
              onClick={() => {
                onChange('');
                close();
                document.getElementById(inputId)?.focus();
              }}
              className="br:size-7 br:shrink-0 br:text-text-muted br:hover:text-text br:[&>svg]:size-4"
            />
          ) : null}
          <ChevronDown
            aria-hidden="true"
            className="br:size-4 br:shrink-0 br:text-text-muted br:transition-[rotate] br:duration-base br:ease-out br:group-data-[state=open]:rotate-180 br:motion-reduce:transition-none"
          />
        </div>
      </RadixPopover.Anchor>
      <RadixPopover.Portal>
        {/* biome-ignore lint/a11y/useValidAriaRole: clears Radix's role="dialog"; the listbox inside carries the semantics and focus stays in the input. */}
        <RadixPopover.Content
          role={undefined}
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            const anchor = document.getElementById(inputId)?.parentElement;
            if (anchor?.contains(e.target as Node)) e.preventDefault();
          }}
          // Presses inside the list (options, scrollbar, 載入更多) must not blur the input.
          onMouseDown={(e) => e.preventDefault()}
          className={cn(POPOVER_SURFACE, 'br:w-(--radix-popover-trigger-width) br:p-1')}
        >
          <div
            ref={setListRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            aria-multiselectable={multiple || undefined}
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_THRESHOLD)
                loadMore();
            }}
            className="br:relative br:max-h-64 br:overflow-y-auto"
          >
            <HighlightIndicator state={highlight} />
            {renderGroups(visible, (o, i) => {
              const selected = values.includes(o.value);
              return (
                // biome-ignore lint/a11y/useFocusableInteractive: aria-activedescendant pattern; the input keeps focus and handles keys.
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is the input's Enter.
                <div
                  key={o.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={o.disabled || undefined}
                  data-highlighted={i === active ? '' : undefined}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    'br:relative br:flex br:min-h-9 br:cursor-default br:flex-col br:justify-center br:rounded-input br:py-1.5 br:pr-3 br:pl-8 br:text-sm br:text-text br:select-none',
                    HIGHLIGHT_RING,
                    o.disabled && 'br:opacity-50',
                  )}
                >
                  {selected ? (
                    <Check
                      aria-hidden="true"
                      className="br:absolute br:top-1/2 br:left-2 br:size-4 br:-translate-y-1/2 br:text-accent"
                    />
                  ) : null}
                  <span>{o.label}</span>
                  {o.description ? (
                    <span className="br:text-xs br:text-text-muted">{o.description}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div
            role="status"
            className="br:px-3 br:py-2 br:text-sm br:text-text-muted br:empty:hidden"
          >
            {status}
          </div>
          {/* Mouse buttons; the keyboard gets the same through ↓ past the last option (and Enter for 重試). */}
          {remoteMode && failure && !loading ? (
            <ListButton onClick={retry}>{t('combobox.retry')}</ListButton>
          ) : remoteMode && remote.hasMore && !loading ? (
            <ListButton onClick={loadMore}>{t('combobox.loadMore')}</ListButton>
          ) : null}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

function ListButton({ onClick, children }: { onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      className="br:mt-1 br:flex br:h-9 br:w-full br:items-center br:justify-center br:rounded-input br:text-sm br:text-text-muted br:transition-colors br:duration-fast br:hover:bg-surface-canvas br:hover:text-text"
    >
      {children}
    </button>
  );
}

/** Options in order; consecutive options sharing `group` sit under that group's heading. */
function renderGroups(
  items: OptionItem[],
  renderOption: (o: OptionItem, index: number) => ReactNode,
): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < items.length) {
    const group = items[i]?.group;
    if (group === undefined) {
      out.push(renderOption(items[i] as OptionItem, i));
      i++;
      continue;
    }
    const start = i;
    const members: ReactNode[] = [];
    while (i < items.length && items[i]?.group === group) {
      members.push(renderOption(items[i] as OptionItem, i));
      i++;
    }
    out.push(
      // biome-ignore lint/a11y/useSemanticElements: an ARIA listbox group, not a form fieldset.
      <div key={`group-${start}`} role="group" aria-label={group}>
        <div
          aria-hidden="true"
          className="br:px-3 br:pt-2 br:pb-1 br:text-xs br:font-semibold br:text-text-muted"
        >
          {group}
        </div>
        {members}
      </div>,
    );
  }
  return out;
}
