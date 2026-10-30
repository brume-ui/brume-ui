import {
  type ClipboardEvent,
  type InputHTMLAttributes,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '../cn';
import { roundDecimal as roundTo, decimalToWire as toWire } from '../decimal';
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
      | 'onPaste'
    > {
  /** Wire format: '' (empty), '12', '-3', '1280.50'. Never grouped. */
  value: string;
  /** Receives the wire format, without grouping separators; '' when the field holds no number. */
  onChange(value: string): void;
  /**
   * Fraction digits. Typing more is refused, a paste is rounded (half away from zero), blur pads
   * to this many. An outside value with more is shown rounded and kept as is until edited.
   * 0 = integer. Omit for any.
   */
  decimals?: number;
  /** Visual prefix such as 'NT$'. Hidden from screen readers; it is added to the field's name instead. */
  prefix?: string;
  /** Include the visual prefix in the accessible name (default true). */
  announcePrefix?: boolean;
  /**
   * A minus sign is accepted only when `min` < 0 (or the value is already negative). Nothing is
   * clamped: range checks are the validator's job (`ClientRule` min / max), so there is no `max`.
   */
  min?: number;
  /** Thousands separators while not focused; focus shows the plain value for editing. */
  grouping?: boolean;
  ref?: Ref<HTMLInputElement>;
}

const WIRE = /^-?\d*\.?\d*$/;

/**
 * Full-width input (zh IMEs) as ASCII: NFKC folds ０-９ ． ， － and the ideographic space; the
 * minus sign U+2212 is folded by hand. Thousands separators are removed only where they form
 * valid groups ('1,280.5'); any other comma ('1,5') makes the text not a number (null).
 */
function toAscii(text: string): string | null {
  const ascii = text
    .normalize('NFKC')
    .replace(/\u2212/g, '-')
    .trim();
  if (!ascii.includes(',')) return ascii;
  const [int = '', ...rest] = ascii.split('.');
  if (!/^-?\d{1,3}(,\d{3})+$/.test(int)) return null;
  return [int.replace(/,/g, ''), ...rest].join('.');
}

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
  announcePrefix = true,
  min,
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

  /** An outside value that is already negative stays editable even without a negative `min`. */
  const negativeAtFocus = useRef(false);
  const allowMinus = (min !== undefined && min < 0) || negativeAtFocus.current;
  const fraction =
    decimals === 0 ? '' : `(\\.\\d${decimals === undefined ? '*' : `{0,${decimals}}`})?`;
  const accepts = new RegExp(`^${allowMinus ? '-?' : ''}\\d*${fraction}$`);

  const plain = (v: string) =>
    WIRE.test(v) ? toWire(decimals === undefined ? v : roundTo(v, decimals), decimals, true) : v;
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

  /** Takes `text` as the new draft if it is a number this field accepts; false otherwise. */
  const accept = (text: string): boolean => {
    if (!accepts.test(text)) return false;
    setDraft(text);
    edited.current = true;
    emit(toWire(text, decimals, false));
    return true;
  };

  /**
   * A paste keeps only the number: currency symbols, letters, spaces and thousands separators
   * go ('NT$1,280', '1 280', '1,280.50 元'), and extra fraction digits are rounded. A paste with
   * no number in it, or one this field would refuse, changes nothing.
   */
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const raw = e.clipboardData
      .getData('text')
      .normalize('NFKC')
      .replace(/\u2212/g, '-');
    const pasted = toAscii(raw.replace(/[^\d.,-]/g, ''));
    if (pasted === null || !WIRE.test(pasted) || !/\d/.test(pasted)) return;
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const combined = draft.slice(0, start) + pasted + draft.slice(end);
    if (!WIRE.test(combined)) return;
    accept(decimals === undefined ? combined : roundTo(combined, decimals));
  };

  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  const name =
    prefix && announcePrefix
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
        negativeAtFocus.current = value.startsWith('-');
        setDraft(plain(value));
        edited.current = false;
        setFocused(true);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const text = toAscii(e.target.value);
        if (text !== null) accept(text);
      }}
      onPaste={onPaste}
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
        // Fade the disabled input itself; the prefix is ordinary text and keeps full contrast.
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
      {announcePrefix && !ariaLabel && !labelledBy ? (
        <label htmlFor={inputId} className="br:sr-only">
          {prefix}
        </label>
      ) : null}
      {input}
    </div>
  );
}
