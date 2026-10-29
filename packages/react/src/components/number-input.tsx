import { type InputHTMLAttributes, type Ref, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../cn';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BORDER, CONTROL_SKIN } from './focus';
import { TextInput } from './text-input';

export interface NumberInputProps
  extends FieldControlProps,
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      | keyof FieldControlProps
      | 'value'
      | 'defaultValue'
      | 'onChange'
      | 'type'
      | 'inputMode'
      | 'min'
      | 'max'
      | 'prefix'
    > {
  /** Wire format: '' (empty), '12', '-3', '1280.50'. Never grouped. */
  value: string;
  /** Receives the wire format, without grouping separators; '' when the field holds no number. */
  onChange(value: string): void;
  /** Fraction digits: more are refused, blur pads to this many. 0 = integer. Omit for any. */
  decimals?: number;
  /** Visual prefix such as 'NT$'. Hidden from screen readers; it is added to the field's name instead. */
  prefix?: string;
  /** A minus sign is accepted only when `min` < 0. Not clamped: validation reports out-of-range values. */
  min?: number;
  max?: number;
  /** Thousands separators while not focused; focus shows the plain value for editing. */
  grouping?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** The wire value of `text` (digits, one point, maybe a leading minus): no leading zeros, no bare point. */
function toWire(text: string, decimals: number | undefined, pad: boolean): string {
  if (!/\d/.test(text)) return '';
  const negative = text.startsWith('-');
  const [rawInt = '', rawFrac = ''] = (negative ? text.slice(1) : text).split('.');
  const int = rawInt.replace(/^0+(?=\d)/, '') || '0';
  const frac = pad && decimals !== undefined ? rawFrac.padEnd(decimals, '0') : rawFrac;
  const out = frac ? `${int}.${frac}` : int;
  return negative && /[1-9]/.test(out) ? `-${out}` : out;
}

const WIRE = /^-?\d*\.?\d*$/;

const group = (wire: string) => {
  const [int = '', frac] = wire.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
};

/**
 * Text field for numbers that keeps the value as a string (decimal and currency travel as
 * fixed-decimal strings, so no float rounding). Typing that would not be a number, or that has
 * more than `decimals` fraction digits, is refused. Blur pads the fraction and, with `grouping`,
 * shows thousands separators; `onChange` always gets the ungrouped wire value.
 */
export function NumberInput({
  value,
  onChange,
  decimals,
  prefix,
  min,
  max: _max,
  grouping,
  invalid,
  id,
  disabled,
  className,
  onFocus,
  onBlur,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  ...rest
}: NumberInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const prefixId = `${inputId}-prefix`;
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const edited = useRef(false);
  /** The last value sent; a `value` equal to it is our own echo, not an outside change. */
  const sent = useRef(value);

  const fraction =
    decimals === 0 ? '' : `(\\.\\d${decimals === undefined ? '*' : `{0,${decimals}}`})?`;
  const accepts = new RegExp(`^${min !== undefined && min < 0 ? '-?' : ''}\\d*${fraction}$`);

  const plain = (v: string) => (WIRE.test(v) ? toWire(v, decimals, true) : v);
  const shown = focused ? draft : grouping ? group(plain(value)) : plain(value);

  // A value replaced from outside while editing (a form reset) replaces the draft.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reacts to outside value changes only.
  useEffect(() => {
    if (focused && value !== sent.current) {
      setDraft(plain(value));
      edited.current = false;
    }
    sent.current = value;
  }, [value]);

  const emit = (next: string) => {
    if (next === value) return;
    sent.current = next;
    onChange(next);
  };

  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  const name = prefix
    ? {
        'aria-label': ariaLabel ? `${ariaLabel} ${prefix}` : undefined,
        'aria-labelledby': labelledBy && !ariaLabel ? `${labelledBy} ${prefixId}` : undefined,
      }
    : { 'aria-label': ariaLabel, 'aria-labelledby': labelledBy };

  const input = (
    <TextInput
      {...rest}
      {...name}
      id={inputId}
      disabled={disabled}
      inputMode={decimals === 0 ? 'numeric' : 'decimal'}
      autoComplete="off"
      invalid={isInvalid}
      aria-required={ariaOn(ariaRequired) || undefined}
      value={shown}
      onFocus={(e) => {
        setDraft(plain(value));
        edited.current = false;
        setFocused(true);
        onFocus?.(e);
      }}
      onChange={(e) => {
        // Separators are display only; a pasted '1,280.50' is taken as 1280.50.
        const text = e.target.value.replace(/,/g, '').trim();
        if (!accepts.test(text)) return;
        setDraft(text);
        edited.current = true;
        emit(toWire(text, decimals, false));
      }}
      onBlur={(e) => {
        setFocused(false);
        if (edited.current) emit(toWire(draft, decimals, true));
        onBlur?.(e);
      }}
      className={cn(
        'br:tabular-nums',
        prefix &&
          'br:h-auto br:min-w-0 br:flex-1 br:border-0 br:bg-transparent br:pl-1.5 br:focus-visible:animate-none br:focus-visible:outline-none',
        prefix ? undefined : className,
      )}
    />
  );
  if (!prefix) return input;

  return (
    <div
      className={cn(
        CONTROL_SKIN,
        'br:flex br:w-full br:items-stretch br:rounded-input br:pl-3',
        isInvalid ? 'br:border-danger' : CONTROL_BORDER,
        !isInvalid && !disabled && 'br:hover:border-text-muted',
        'br:has-[input:focus-visible]:outline-solid br:has-[input:focus-visible]:outline-2 br:has-[input:focus-visible]:outline-offset-2 br:has-[input:focus-visible]:outline-focus-ring',
        disabled && 'br:opacity-50',
        className,
      )}
    >
      <span
        id={prefixId}
        aria-hidden="true"
        className="br:flex br:shrink-0 br:items-center br:text-sm br:text-text-muted"
      >
        {prefix}
      </span>
      {/* Under a <label for>, a second label adds the prefix after the caption in the name. */}
      {!ariaLabel && !labelledBy ? (
        <label htmlFor={inputId} className="br:sr-only">
          {prefix}
        </label>
      ) : null}
      {input}
    </div>
  );
}
