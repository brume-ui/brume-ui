import type { Option } from '@brume-ui/brume-schema';
import { type KeyboardEvent, useId, useRef } from 'react';
import { cn } from '../cn';
import { PRESS } from '../motion/classes';
import { FOCUS_RING } from './focus';

/** A small outlined pill; the chosen one takes the selected surface (no accent: it is not a count). */
const PILL = cn(
  'br:inline-flex br:h-8 br:items-center br:rounded-pill br:border br:px-3 br:text-sm br:font-semibold br:whitespace-nowrap br:disabled:cursor-not-allowed br:disabled:opacity-50',
  'br:border-border br:bg-surface br:text-text-muted br:enabled:hover:border-border-strong br:enabled:hover:text-text',
  'br:aria-checked:border-border-strong br:aria-checked:bg-surface-selected br:aria-checked:text-text',
  'br:aria-pressed:border-border-strong br:aria-pressed:bg-surface-selected br:aria-pressed:text-text',
  PRESS,
  FOCUS_RING,
);

const ROW = 'br:flex br:flex-wrap br:items-center br:gap-2';

export interface PillRadioGroupProps {
  options: Option[];
  /** May be '' (an 「all」 choice that maps to no value). */
  value: string;
  onChange(value: string): void;
  /** Accessible name of the group. */
  label: string;
}

/**
 * One choice shown as pills (list scopes). A radio group with manual activation: arrow keys,
 * Home and End only move focus (each choice may load a new page), Space or Enter selects. One
 * tab stop, the checked pill (else the first enabled one).
 */
export function PillRadioGroup({ options, value, onChange, label }: PillRadioGroupProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.flatMap((o, i) => (o.disabled ? [] : [i]));
  const checkedIndex = options.findIndex((o) => o.value === value && !o.disabled);
  const tabStop = checkedIndex >= 0 ? checkedIndex : (enabled[0] ?? -1);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const at = enabled.indexOf(index);
    let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = enabled[(at + 1) % enabled.length];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = enabled[(at - 1 + enabled.length) % enabled.length];
    } else if (event.key === 'Home') {
      next = enabled[0];
    } else if (event.key === 'End') {
      next = enabled.at(-1);
    }
    if (next === undefined) return;
    event.preventDefault();
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={ROW}>
      {options.map((o, i) => (
        // biome-ignore lint/a11y/useSemanticElements: a native radio cannot take the pill look or manual activation.
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={i === tabStop ? 0 : -1}
          disabled={o.disabled}
          onClick={() => {
            if (o.value !== value) onChange(o.value);
          }}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={PILL}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface PillToggleGroupProps {
  options: Option[];
  value: string[];
  /** The new selection, in option order. */
  onChange(value: string[]): void;
  /** Accessible name of the group; shown before the pills with `showLabel`. */
  label: string;
  showLabel?: boolean;
  /** Several pills may be on; otherwise a click picks one, and clicking the picked one clears it. */
  multiple?: boolean;
}

/** Toggle buttons shown as pills (list selectors). Each pill is a button with `aria-pressed`. */
export function PillToggleGroup({
  options,
  value,
  onChange,
  label,
  showLabel = false,
  multiple = false,
}: PillToggleGroupProps) {
  const labelId = useId();
  const toggle = (v: string) => {
    const on = value.includes(v);
    if (!multiple) return onChange(on ? [] : [v]);
    const next = new Set(value);
    if (on) next.delete(v);
    else next.add(v);
    onChange(options.map((o) => o.value).filter((x) => next.has(x)));
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset's legend cannot sit inline with the pills.
    <div
      role="group"
      aria-label={showLabel ? undefined : label}
      aria-labelledby={showLabel ? labelId : undefined}
      className={ROW}
    >
      {showLabel ? (
        <span id={labelId} className="br:mr-1 br:text-sm br:text-text-muted">
          {label}
        </span>
      ) : null}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value.includes(o.value)}
          disabled={o.disabled}
          onClick={() => toggle(o.value)}
          className={PILL}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
