import type { Option, OptionItem } from '@brume-ui/brume-schema';
import * as RadixPopover from '@radix-ui/react-popover';
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../cn';
import { HighlightIndicator, useHighlightIndicator } from '../motion/highlight';
import { useBrume } from '../provider';
import { Chip } from './chip';
import type { ComboboxLoader } from './combobox';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BORDER, CONTROL_SKIN, HIGHLIGHT_RING } from './focus';
import { POPOVER_SURFACE } from './popover';

export interface TagsInputProps extends FieldControlProps {
  value: string[];
  onBlur?(): void;
  onChange(value: string[]): void;
  /** Suggestions shown in a listbox while typing; any other text can still be added. */
  options?: Option[];
  load?: ComboboxLoader;
  resolveLabels?(values: string[]): Promise<OptionItem[]>;
  scopeKey?: unknown;
  cancelLabels?(): void;
  cancelLoad?(): void;
  /** Sibling exclusions apply to typing, paste and suggestion selection. */
  blockedValues?: string[];
  /** At this many tags the text input is disabled (chips stay removable). */
  max?: number;
  /**
   * Longest tag, in UTF-16 units like a native `maxlength`, applied per tag: typed text stops
   * there, a longer pasted or comma-split piece is cut, and longer option values are not offered.
   */
  maxLength?: number;
  /** Default 「輸入後按 Enter 新增」. */
  placeholder?: string;
  /** Accessible name of the field (and of the suggestion list). */
  label: string;
  disabled?: boolean;
}

/** Commas, ASCII or full-width (zh IMEs type 「，」), separate tags in typed or pasted text. */
const SEPARATOR = /[,，]/;

/**
 * Free-text tags shown as chips. Enter or a comma adds the typed text, a duplicate is ignored, and
 * Backspace in the empty input removes the last tag. While an IME is composing (zh/ja input,
 * `isComposing` or keyCode 229) Enter only picks the candidate. With `options`, matching
 * suggestions show in a listbox (WAI-ARIA combobox): ↑/↓ move, Enter adds the active one.
 */
export function TagsInput({
  value,
  onChange,
  options,
  load,
  resolveLabels,
  scopeKey,
  cancelLabels,
  cancelLoad,
  blockedValues,
  onBlur,
  max,
  maxLength,
  placeholder,
  label,
  disabled,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: TagsInputProps) {
  const { t } = useBrume();
  const autoId = useId();
  const inputId = id ?? autoId;
  const listboxId = `${inputId}-listbox`;
  const optionId = (i: number) => `${inputId}-option-${i}`;
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const composing = useRef(false);
  const [composingState, setComposing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  /**
   * Where focus goes after the next change of tags: an add that fills the last slot disables the
   * input (focus moves to the last chip's ✕); a removed chip takes its ✕ along (focus returns to
   * the input, enabled again by then).
   */
  const refocus = useRef<'input' | 'lastChip' | null>(null);

  const atMax = max !== undefined && value.length >= max;
  const [known, setKnown] = useState<{ scope: unknown; items: OptionItem[] }>({
    scope: scopeKey,
    items: [],
  });
  const [labelState, setLabelState] = useState<{
    scope: unknown;
    missing: string[];
    failed: boolean;
    loading: boolean;
  }>({ scope: scopeKey, missing: [], failed: false, loading: false });
  const unavailable = labelState.scope === scopeKey ? labelState.missing : [];
  const labelFailure = labelState.scope === scopeKey && labelState.failed;
  const labelLoading = labelState.scope === scopeKey && labelState.loading;
  const [labelRetry, setLabelRetry] = useState(0);
  const [remoteState, setRemote] = useState<{
    scope: unknown;
    items: OptionItem[];
    page: number;
    hasMore: boolean;
  }>({ scope: scopeKey, items: [], page: 0, hasMore: false });
  const remote =
    remoteState.scope === scopeKey ? remoteState : { items: [], page: 0, hasMore: false };
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState(false);
  const generation = useRef(0);
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const cancelLoadRef = useRef(cancelLoad);
  cancelLoadRef.current = cancelLoad;
  const loadRef = useRef(load);
  loadRef.current = load;
  const remoteMode = !!load;
  const labelOf = (v: string) =>
    unavailable.includes(v)
      ? t('combobox.unavailable', { value: v })
      : ((known.scope === scopeKey ? known.items.find((o) => o.value === v)?.label : undefined) ??
        options?.find((o) => o.value === v)?.label ??
        v);
  const valuesKey = JSON.stringify(value);
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit scope and selection own hydration, not callback identity.
  useEffect(() => {
    setLabelState({
      scope: scopeKey,
      missing: [],
      failed: false,
      loading: !!resolveLabels && value.length > 0,
    });
    if (!resolveLabels || value.length === 0) {
      cancelLabels?.();
      return;
    }
    let current = true;
    const scope = scopeKey;
    resolveLabels(value).then(
      (items) => {
        if (!current || scopeRef.current !== scope) return;
        setKnown({ scope, items });
        setLabelState({
          scope,
          missing: value.filter((v) => !items.some((o) => o.value === v)),
          failed: false,
          loading: false,
        });
      },
      () => {
        if (current && scopeRef.current === scope)
          setLabelState({ scope, missing: [], failed: true, loading: false });
      },
    );
    return () => {
      current = false;
      cancelLabels?.();
    };
  }, [valuesKey, scopeKey, labelRetry]);
  const fetchPage = useCallback(async (q: string, page: number) => {
    const loader = loadRef.current;
    if (!loader) return;
    const token = ++generation.current;
    const scope = scopeRef.current;
    setLoading(true);
    setFailure(false);
    try {
      const result = await loader({ q, page });
      if (token !== generation.current) return;
      setRemote((prev) => ({
        scope,
        items: page === 1 ? result.options : [...prev.items, ...result.options],
        page,
        hasMore: result.hasMore,
      }));
    } catch {
      if (token === generation.current) setFailure(true);
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    generation.current++;
    setRemote({ scope: scopeKey, items: [], page: 0, hasMore: false });
    setFailure(false);
    setLoading(remoteMode && open && !composingState);
    if (!remoteMode || !open || composingState) return;
    const timer = setTimeout(() => {
      void fetchPage(query, 1);
    }, 250);
    return () => {
      clearTimeout(timer);
      generation.current++;
      cancelLoadRef.current?.();
    };
  }, [remoteMode, open, query, scopeKey, composingState, fetchPage]);
  const isBlocked = (v: string) => !!blockedValues?.includes(v) && !value.includes(v);
  const sourceOptions = remoteMode ? remote.items : options;
  const q = query.trim().toLowerCase();
  const fits = (v: string) => maxLength === undefined || v.length <= maxLength;
  const cut = (text: string) => (maxLength === undefined ? text : text.slice(0, maxLength));
  const visible = (sourceOptions ?? []).filter(
    (o) =>
      !o.disabled &&
      !isBlocked(o.value) &&
      fits(o.value) &&
      !value.includes(o.value) &&
      (remoteMode || o.label.toLowerCase().includes(q)),
  );
  const listOpen = open && !atMax && (remoteMode || visible.length > 0);
  const status = loading
    ? t('common.loading')
    : failure
      ? t('combobox.loadFailed')
      : visible.length === 0
        ? t('combobox.empty')
        : '';

  const focusInput = () => document.getElementById(inputId)?.focus();

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after the tags change.
  useEffect(() => {
    const target = refocus.current;
    refocus.current = null;
    if (target === 'input') focusInput();
    else if (target === 'lastChip') {
      const buttons = wrapperRef.current?.querySelectorAll('button');
      buttons?.[buttons.length - 1]?.focus();
    }
  }, [value]);

  /** A typed tag: trimmed; the exact label of an option stands for that option's value. */
  const toValue = (text: string) => {
    const trimmed = text.trim();
    return sourceOptions?.find((o) => o.label === trimmed && !o.disabled)?.value ?? cut(trimmed);
  };

  /** Adds each non-empty value not already there, up to `max`. */
  const add = (values: string[]) => {
    const next = [...value];
    for (const v of values) {
      if (v === '' || !fits(v) || isBlocked(v) || next.includes(v)) continue;
      if (max === undefined || next.length < max) next.push(v);
    }
    if (next.length === value.length) return;
    if (max !== undefined && next.length >= max) refocus.current = 'lastChip';
    onChange(next);
  };

  /** Takes the input's text: everything before the last separator becomes tags, the rest stays. */
  const take = (text: string) => {
    const parts = text.split(SEPARATOR);
    const rest = parts.pop() ?? '';
    if (parts.length > 0) add(parts.map(toValue));
    // Not the input's maxlength: that would cut a pasted 'a,b,c' as a whole.
    setQuery(cut(rest));
    setActive(-1);
    setOpen(true);
  };

  const commit = () => {
    const o = listOpen ? visible[active] : undefined;
    if (o) add([o.value]);
    else add([toValue(query)]);
    setQuery('');
    setActive(-1);
  };

  const remove = (v: string) => onChange(value.filter((x) => x !== v));

  const highlight = useHighlightIndicator();
  // Keep the keyboard's option in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: optionId is derived from a stable id.
  useEffect(() => {
    if (active >= 0)
      document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const move = (delta: 1 | -1) => {
    const last = visible.length - 1;
    if (last < 0) return;
    if (!listOpen) {
      setOpen(true);
      setActive(delta === 1 ? 0 : last);
      return;
    }
    setActive((i) => Math.max(0, Math.min(last, i + delta)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // keyCode 229: Safari sends the IME's committing Enter after compositionend.
    if (composing.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
      if (e.key === 'Enter') e.preventDefault();
      return;
    }
    switch (e.key) {
      case 'Enter':
      case ',':
        // An empty Enter is left alone (it may submit the form); a comma never lands in a tag.
        if (e.key === 'Enter' && query.trim() === '' && !(listOpen && active >= 0)) return;
        e.preventDefault();
        commit();
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        if (!options && !remoteMode) return;
        e.preventDefault();
        move(e.key === 'ArrowDown' ? 1 : -1);
        break;
      case 'Escape':
        if (!listOpen) return;
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setActive(-1);
        break;
      case 'Backspace': {
        const last = value.at(-1);
        if (query === '' && last !== undefined) {
          e.preventDefault();
          remove(last);
        }
        break;
      }
    }
  };

  const comboboxProps =
    options || remoteMode
      ? {
          role: 'combobox',
          'aria-expanded': listOpen,
          'aria-controls': listboxId,
          'aria-activedescendant': listOpen && active >= 0 ? optionId(active) : undefined,
          'aria-autocomplete': 'list' as const,
        }
      : {};

  return (
    <RadixPopover.Root
      open={listOpen}
      onOpenChange={(o) => {
        if (!o) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <RadixPopover.Anchor asChild>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer convenience; the input owns keyboard and semantics. */}
        <div
          ref={wrapperRef}
          aria-disabled={disabled || undefined}
          onMouseDown={(e) => {
            // A press on the chrome around the input focuses the input.
            if (disabled || atMax || (e.target as HTMLElement).closest('input,button')) return;
            e.preventDefault();
            focusInput();
          }}
          className={cn(
            CONTROL_SKIN,
            'br:flex br:h-auto br:min-h-10 br:w-full br:cursor-text br:flex-wrap br:items-center br:gap-1 br:rounded-input br:py-1 br:pr-2 br:pl-1.5',
            isInvalid ? 'br:border-danger' : CONTROL_BORDER,
            !isInvalid && 'br:hover:border-text-muted',
            'br:outline-none br:has-[input:focus-visible]:outline-solid br:has-[input:focus-visible]:outline-2 br:has-[input:focus-visible]:outline-offset-2 br:has-[input:focus-visible]:outline-focus-ring',
            disabled && 'br:cursor-not-allowed br:opacity-50',
            atMax && !disabled && 'br:cursor-default',
          )}
        >
          {value.map((v) => (
            <Chip
              key={v}
              value={labelOf(v)}
              removeLabel={t('combobox.remove', { label: labelOf(v) })}
              onRemove={() => {
                if (disabled) return;
                refocus.current = 'input';
                remove(v);
              }}
            />
          ))}
          <input
            {...comboboxProps}
            id={inputId}
            type="text"
            aria-label={labelledBy ? undefined : label}
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            aria-invalid={isInvalid || undefined}
            aria-required={ariaOn(ariaRequired) || undefined}
            autoComplete="off"
            enterKeyHint="enter"
            disabled={disabled || atMax}
            placeholder={value.length > 0 ? undefined : (placeholder ?? t('tags.placeholder'))}
            value={query}
            onChange={(e) => {
              if (composing.current) {
                setQuery(e.target.value);
                return;
              }
              take(e.target.value);
            }}
            onCompositionStart={() => {
              composing.current = true;
              setComposing(true);
            }}
            onCompositionEnd={(e) => {
              composing.current = false;
              setComposing(false);
              take(e.currentTarget.value);
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              onBlur?.();
              setOpen(false);
              setActive(-1);
            }}
            className="br:h-8 br:min-w-[8ch] br:flex-1 br:bg-transparent br:px-1.5 br:text-sm br:text-text br:outline-none br:placeholder:text-text-muted br:disabled:cursor-not-allowed"
          />
        </div>
      </RadixPopover.Anchor>
      {remoteMode ? (
        <div role="status" className="br:sr-only">
          {listOpen ? status : ''}
        </div>
      ) : null}
      {labelLoading ? (
        <div role="status" className="br:sr-only">
          {t('common.loading')}
        </div>
      ) : null}
      {unavailable.length > 0 ? (
        <div role="status">{unavailable.map(labelOf).join(', ')}</div>
      ) : null}
      {labelFailure ? (
        <div role="status">
          {t('combobox.loadFailed')}{' '}
          <button type="button" onClick={() => setLabelRetry((v) => v + 1)}>
            {t('combobox.retry')}
          </button>
        </div>
      ) : null}
      {options || remoteMode ? (
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
              if (wrapperRef.current?.contains(e.target as Node)) e.preventDefault();
            }}
            // Presses inside the list must not blur the input.
            onMouseDown={(e) => e.preventDefault()}
            className={cn(POPOVER_SURFACE, 'br:w-(--radix-popover-trigger-width) br:p-1')}
          >
            <div
              ref={highlight.ref}
              id={listboxId}
              role="listbox"
              aria-label={label}
              aria-multiselectable
              className="br:relative br:max-h-64 br:overflow-y-auto"
            >
              <HighlightIndicator state={highlight} />
              {visible.map((o, i) => (
                // biome-ignore lint/a11y/useFocusableInteractive: aria-activedescendant pattern; the input keeps focus and handles keys.
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is the input's Enter.
                <div
                  key={o.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={false}
                  data-highlighted={i === active ? '' : undefined}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => {
                    add([o.value]);
                    setQuery('');
                    setActive(-1);
                  }}
                  className={cn(
                    'br:relative br:flex br:min-h-9 br:cursor-default br:items-center br:rounded-input br:px-3 br:py-1.5 br:text-sm br:text-text br:select-none',
                    HIGHLIGHT_RING,
                  )}
                >
                  {o.label}
                </div>
              ))}
            </div>
            {remoteMode ? <div aria-hidden="true">{status}</div> : null}
            {remoteMode && failure && !loading ? (
              <button
                type="button"
                onClick={() => {
                  void fetchPage(query, remote.page + 1);
                }}
              >
                {t('combobox.retry')}
              </button>
            ) : null}
            {remoteMode && remote.hasMore && !loading && !failure ? (
              <button
                type="button"
                onClick={() => {
                  void fetchPage(query, remote.page + 1);
                }}
              >
                {t('combobox.loadMore')}
              </button>
            ) : null}
          </RadixPopover.Content>
        </RadixPopover.Portal>
      ) : null}
    </RadixPopover.Root>
  );
}
