import * as RadixPopover from '@radix-ui/react-popover';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING, HIGHLIGHT_RING } from './focus';
import { POPOVER_SURFACE } from './popover';

export interface AutocompleteSuggestion {
  label: string;
  group?: string;
}

export interface AutocompleteInputProps extends FieldControlProps {
  value: string;
  onChange(value: string): void;
  onBlur?(): void;
  /** Accessible name of the input and of its suggestion list. */
  label: string;
  /** Static suggestions, filtered by case-insensitive substring. Ignored when `load` is set. */
  options?: string[];
  /** Remote suggestions for the typed text, debounced 250 ms; the previous request is aborted. */
  load?: (query: string, signal: AbortSignal) => Promise<AutocompleteSuggestion[]>;
  /** Native `maxlength` of the text. */
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

/** Suggestions rendered at most; the rest are reached by typing more. */
const MAX_RENDERED = 50;

/**
 * A plain text input with a WAI-ARIA list-autocomplete combobox. Suggestions never restrict the
 * value: Tab or blur keeps whatever was typed, Enter picks only an actively highlighted
 * suggestion, and never while an IME is composing.
 */
export function AutocompleteInput({
  value,
  onChange,
  onBlur,
  label,
  options,
  load,
  maxLength,
  placeholder,
  disabled,
  readOnly,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: AutocompleteInputProps) {
  const { t } = useBrume();
  const autoId = useId();
  const inputId = id ?? autoId;
  const listboxId = `${inputId}-listbox`;
  const optionId = (i: number) => `${inputId}-option-${i}`;
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [remote, setRemote] = useState<AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  const remoteMode = !!load;
  const inert = Boolean(disabled || readOnly);

  useEffect(() => {
    setRemote([]);
    setFailed(false);
    if (!remoteMode || !open || composing || inert) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // A synchronous throw or a non-promise return takes the same path as a rejection.
      Promise.resolve()
        .then(() => loadRef.current?.(value, controller.signal))
        .then((items) => {
          if (!Array.isArray(items)) throw new Error('load must resolve to an array');
          return items;
        })
        .then(
          (items) => {
            if (controller.signal.aborted) return;
            setRemote(items);
            setLoading(false);
          },
          () => {
            if (controller.signal.aborted) return;
            setFailed(true);
            setLoading(false);
          },
        );
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [remoteMode, open, value, composing, inert]);

  const needle = value.trim().toLowerCase();
  const source: AutocompleteSuggestion[] = remoteMode
    ? remote
    : (options ?? []).filter((o) => o.toLowerCase().includes(needle)).map((o) => ({ label: o }));
  const shown = source.slice(0, MAX_RENDERED);
  const listOpen = open && !inert && (remoteMode || shown.length > 0);
  const status = loading ? t('common.loading') : failed ? t('combobox.loadFailed') : '';

  // Keep the keyboard's option in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: optionId derives from a stable id.
  useEffect(() => {
    if (active >= 0)
      document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const pick = (item: AutocompleteSuggestion) => {
    onChange(item.label);
    setOpen(false);
    setActive(-1);
  };

  const move = (delta: 1 | -1) => {
    const last = shown.length - 1;
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
    if (composingRef.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
      if (e.key === 'Enter') e.preventDefault();
      return;
    }
    switch (e.key) {
      case 'Enter': {
        // Without an active suggestion Enter is left alone: it may submit the form.
        const item = listOpen ? shown[active] : undefined;
        if (!item) return;
        e.preventDefault();
        pick(item);
        break;
      }
      case 'ArrowDown':
      case 'ArrowUp':
        if (inert || (!options && !remoteMode)) return;
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
    }
  };

  const hasSuggestions = !!options || remoteMode;
  const comboboxProps = hasSuggestions
    ? {
        role: 'combobox',
        'aria-expanded': listOpen,
        'aria-controls': listboxId,
        'aria-activedescendant': listOpen && active >= 0 ? optionId(active) : undefined,
        'aria-autocomplete': 'list' as const,
      }
    : {};

  // Group headings: a heading is drawn before the first option of each group, in order of appearance.
  const groups: {
    name: string | undefined;
    items: { item: AutocompleteSuggestion; index: number }[];
  }[] = [];
  shown.forEach((item, index) => {
    const last = groups.at(-1);
    if (last && last.name === item.group) last.items.push({ item, index });
    else groups.push({ name: item.group, items: [{ item, index }] });
  });

  const renderOption = (item: AutocompleteSuggestion, i: number) => (
    // biome-ignore lint/a11y/useFocusableInteractive: aria-activedescendant pattern; the input keeps focus and handles keys.
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is the input's Enter.
    <div
      key={`${i}-${item.label}`}
      id={optionId(i)}
      role="option"
      aria-selected={i === active}
      data-highlighted={i === active ? '' : undefined}
      onMouseMove={() => i !== active && setActive(i)}
      onClick={() => pick(item)}
      className={cn(
        'br:relative br:flex br:min-h-9 br:cursor-default br:items-center br:rounded-input br:px-3 br:py-1.5 br:text-sm br:text-text br:select-none',
        HIGHLIGHT_RING,
      )}
    >
      {item.label}
    </div>
  );

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
        <div ref={wrapperRef} className="br:w-full">
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
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onCompositionStart={() => {
              composingRef.current = true;
              setComposing(true);
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
              setComposing(false);
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              onBlur?.();
              setOpen(false);
              setActive(-1);
            }}
            className={cn(
              CONTROL_BASE,
              isInvalid ? 'br:border-danger' : CONTROL_BORDER,
              readOnly && 'br:bg-surface-canvas',
              FOCUS_RING,
              'br:w-full br:min-w-0',
            )}
          />
        </div>
      </RadixPopover.Anchor>
      {remoteMode ? (
        <div role="status" className="br:sr-only">
          {listOpen ? status : ''}
        </div>
      ) : null}
      {hasSuggestions ? (
        <RadixPopover.Portal>
          {/* A region (not Radix's default dialog, the combobox owns the popup semantics) keeps the portalled list inside a landmark for axe's `region` rule. */}
          <RadixPopover.Content
            role="region"
            aria-label={label}
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
              id={listboxId}
              role="listbox"
              aria-label={label}
              className="br:relative br:max-h-64 br:overflow-y-auto"
            >
              {groups.map((g, gi) =>
                g.name === undefined ? (
                  g.items.map(({ item, index }) => renderOption(item, index))
                ) : (
                  // biome-ignore lint/a11y/useSemanticElements: ARIA listbox groups are role=group elements, not fieldsets.
                  <div
                    key={`${g.name}-${g.items[0]?.item.label}`}
                    role="group"
                    aria-labelledby={`${inputId}-group-${gi}`}
                  >
                    <div
                      id={`${inputId}-group-${gi}`}
                      role="presentation"
                      className="br:px-3 br:py-1 br:text-xs br:font-medium br:text-text-muted"
                    >
                      {g.name}
                    </div>
                    {g.items.map(({ item, index }) => renderOption(item, index))}
                  </div>
                ),
              )}
            </div>
            {remoteMode && status ? (
              <div aria-hidden="true" className="br:px-3 br:py-2 br:text-sm br:text-text-muted">
                {status}
              </div>
            ) : null}
          </RadixPopover.Content>
        </RadixPopover.Portal>
      ) : null}
    </RadixPopover.Root>
  );
}
