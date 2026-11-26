import { cn } from '../cn';
import { ariaOn, type FieldControlProps } from './field';
import { FOCUS_RING } from './focus';

export interface SliderProps extends FieldControlProps {
  /** `null` shows the thumb at `min` without choosing a value. */
  value: number | null;
  /** Called only when the user moves the slider; always a number on the `min + k * step` grid. */
  onChange(value: number): void;
  min: number;
  max: number;
  step: number;
  /** Accessible name of the slider. */
  label: string;
  disabled?: boolean;
  onBlur?(): void;
}

/** Fraction digits of a number as written (handles `1e-7`). */
function fractionDigits(n: number): number {
  const [mantissa = '', exponent] = String(n).split('e');
  const own = (mantissa.split('.')[1] ?? '').length;
  return Math.max(0, own - (exponent === undefined ? 0 : Number(exponent)));
}

/** Fraction digits that every value of the grid needs. */
function gridDigits(min: number, step: number): number {
  return Math.max(fractionDigits(step), fractionDigits(min));
}

/**
 * Snaps `raw` to the nearest `min + k * step` within [min, max]. The step count is rounded after
 * trimming float noise and the result is rounded to the grid's fraction digits, so
 * `min 0, step 0.1` gives `0.3` exactly, never `0.30000000000000004`.
 */
export function snapSlider(raw: number, min: number, max: number, step: number): number {
  const digits = gridDigits(min, step);
  const maxK = Math.floor(Number(((max - min) / step).toFixed(9)));
  const k = Math.round(Number(((raw - min) / step).toFixed(9)));
  const clamped = Math.min(Math.max(k, 0), maxK);
  return Number((min + clamped * step).toFixed(digits));
}

/**
 * Native range input with a visible numeric readout. The browser owns keyboard (arrows, Home / End,
 * Page keys) and screen-reader behaviour (the range role has no required state, so `aria-required`
 * is not forwarded; the caption's required mark and server validation cover it); `aria-valuetext` carries the formatted value. The filled
 * ink comes from the `text` token through `accent-color`, so dark mode follows the theme.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  label,
  disabled,
  onBlur,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  invalid,
}: SliderProps) {
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  const digits = gridDigits(min, step);
  // An off-grid record value shows (and is announced) as the nearest grid point, as the browser draws it.
  const shown = snapSlider(value ?? min, min, max, step);
  const text = shown.toFixed(digits);
  return (
    <div className="br:flex br:w-full br:items-center br:gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={isInvalid || undefined}
        aria-valuetext={text}
        onChange={(e) => onChange(snapSlider(Number(e.target.value), min, max, step))}
        onBlur={onBlur}
        className={cn(
          'br:h-9 br:min-w-0 br:flex-1 br:cursor-pointer br:rounded-input br:accent-text br:disabled:cursor-not-allowed br:disabled:opacity-50',
          isInvalid && 'br:accent-danger',
          FOCUS_RING,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'br:min-w-10 br:shrink-0 br:text-right br:text-sm br:tabular-nums',
          value === null || disabled ? 'br:text-text-muted' : 'br:text-text',
        )}
      >
        {text}
      </span>
    </div>
  );
}
