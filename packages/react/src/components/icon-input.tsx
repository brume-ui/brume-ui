import { Circle, icons } from 'lucide-react';
import { type KeyboardEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../cn';
import { resolveIcon } from '../layout/menu-utils';
import { useBrume } from '../provider';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';
import { Popover } from './popover';

export interface IconInputProps extends FieldControlProps {
  /** A lucide icon name in kebab-case; unknown names are kept as typed. */
  value: string;
  onChange(value: string): void;
  onBlur?(): void;
  /** Restricts the picker to these names (the text box still accepts anything). */
  icons?: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Accessible name of the field; also names the picker button and its panel. */
  label: string;
}

/** Most icon buttons ever rendered at once; the rest is reached by searching. */
export const MAX_ICON_RESULTS = 120;
const COLUMNS = 8;

/** `Grid3x3` -> `grid-3x3`, `ArrowDown01` -> `arrow-down-01`, `ALargeSmall` -> `a-large-small`. */
function toKebab(pascal: string): string {
  return pascal
    .replace(/(?<![0-9])([a-z])([0-9])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/** Every lucide icon name in kebab-case (the same naming the menu resolves), computed once. */
let iconNames: string[] | null = null;
export function getIconNames(): string[] {
  iconNames ??= [...new Set(Object.keys(icons).map(toKebab))].sort();
  return iconNames;
}

/** An icon by its kebab-case lucide name; unknown names show the menu's fallback glyph. */
export function IconGlyph({ name, className }: { name: string; className?: string }) {
  const Icon = resolveIcon(name);
  return <Icon aria-hidden="true" className={cn('br:pointer-events-none', className)} />;
}

/**
 * Icon name field: an editable text box with the current glyph on a trigger that opens a search
 * and a grid of icons (at most 120 at a time). The grid is a roving-tabindex list: arrows, Home and
 * End move, Enter or Space picks, Escape closes and focus returns to the trigger.
 */
export function IconInput({
  value,
  onChange,
  onBlur,
  icons: allowed,
  placeholder,
  disabled,
  label,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: IconInputProps) {
  const { t } = useBrume();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const deferred = useDeferredValue(query);
  const searchRef = useRef<HTMLInputElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // A disabled field never keeps a panel open, and re-enabling must not bring it back.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);

  const pool = useMemo(() => allowed ?? getIconNames(), [allowed]);
  const matches = useMemo(() => {
    const needle = deferred.trim().toLowerCase();
    return needle === '' ? pool : pool.filter((name) => name.includes(needle));
  }, [pool, deferred]);
  const shown = matches.slice(0, MAX_ICON_RESULTS);
  const capped = matches.length > shown.length;
  const valueIcon = resolveIcon(value.trim());
  // Unknown names fall back to Circle, which must not match every other unknown name.
  const valueKnown = valueIcon !== Circle || value.trim() === 'circle';
  const current = Math.min(active, Math.max(shown.length - 1, 0));

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery('');
      setActive(0);
    }
  };
  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };
  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(shown.length - 1, index));
    setActive(next);
    buttons.current[next]?.focus();
  };
  const onGridKey = (event: KeyboardEvent<HTMLButtonElement>, index: number, name: string) => {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
    };
    if (event.key === 'ArrowUp' && index < COLUMNS) {
      event.preventDefault();
      searchRef.current?.focus();
    } else if (event.key in step) {
      event.preventDefault();
      moveTo(index + (step[event.key] ?? 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveTo(shown.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(name);
    }
  };

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      aria-label={t('icon.open', { label })}
      className={cn(
        'br:absolute br:top-1/2 br:left-2 br:inline-flex br:size-6 br:-translate-y-1/2 br:items-center br:justify-center br:rounded-input br:border br:border-border-strong br:bg-surface br:p-0 br:text-text br:disabled:cursor-not-allowed',
        FOCUS_RING,
      )}
    >
      <IconGlyph name={value.trim()} className="br:size-4" />
    </button>
  );

  return (
    <div className="br:relative br:w-full">
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={isInvalid || undefined}
        aria-required={ariaOn(ariaRequired) || undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlur?.()}
        className={cn(
          CONTROL_BASE,
          'br:w-full br:pl-11 br:font-mono',
          isInvalid ? 'br:border-danger' : CONTROL_BORDER,
          FOCUS_RING,
        )}
      />
      <Popover trigger={trigger} title={label} open={open && !disabled} onOpenChange={changeOpen}>
        <input
          ref={searchRef}
          type="search"
          value={query}
          aria-label={t('icon.search')}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && shown.length > 0) {
              e.preventDefault();
              moveTo(0);
            }
          }}
          className={cn(CONTROL_BASE, CONTROL_BORDER, 'br:mb-3 br:w-full', FOCUS_RING)}
        />
        {shown.length === 0 ? (
          <p className="br:m-0 br:text-text-muted">{t('icon.empty')}</p>
        ) : (
          <fieldset
            aria-label={t('icon.grid')}
            className="br:m-0 br:grid br:max-h-60 br:min-w-0 br:grid-cols-8 br:gap-1 br:overflow-y-auto br:border-0 br:p-0"
          >
            {shown.map((name, index) => (
              <button
                key={name}
                ref={(el) => {
                  buttons.current[index] = el;
                }}
                type="button"
                aria-label={name}
                title={name}
                tabIndex={index === current ? 0 : -1}
                aria-pressed={valueKnown && resolveIcon(name) === valueIcon}
                onClick={() => pick(name)}
                onKeyDown={(e) => onGridKey(e, index, name)}
                className={cn(
                  'br:inline-flex br:size-8 br:items-center br:justify-center br:rounded-input br:p-0 br:text-text br:hover:bg-surface-canvas br:aria-pressed:bg-accent-tint br:aria-pressed:text-accent-tint-text',
                  FOCUS_RING,
                )}
              >
                <IconGlyph name={name} className="br:size-5" />
              </button>
            ))}
          </fieldset>
        )}
        {capped ? (
          <p className="br:m-0 br:mt-2 br:text-xs br:text-text-muted">
            {t('icon.refine', { max: MAX_ICON_RESULTS })}
          </p>
        ) : null}
      </Popover>
    </div>
  );
}
