import { ariaOn, type FieldControlProps } from './field';
import { TextInput } from './text-input';

export interface TimeInputProps extends FieldControlProps {
  /** `HH:mm`, or `HH:mm:ss` with `seconds`; '' when empty. The native value passes through. */
  value: string;
  onChange(value: string): void;
  /** Offer seconds (native `step` 1) instead of whole minutes (`step` 60). */
  seconds?: boolean;
  /** Accessible name of the field. */
  label: string;
  name?: string;
  disabled?: boolean;
  onBlur?(): void;
}

/**
 * Native time field styled like DateInput. Native on purpose: 24-hour or 12-hour entry follows
 * the user's locale, while the value is always 24-hour `HH:mm[:ss]`. Dark mode follows the
 * inherited `color-scheme` from tokens.css, as in DateInput.
 */
export function TimeInput({
  value,
  onChange,
  seconds,
  label,
  'aria-required': ariaRequired,
  ...rest
}: TimeInputProps) {
  return (
    <TextInput
      {...rest}
      type="time"
      step={seconds ? 1 : 60}
      aria-label={label}
      aria-required={ariaOn(ariaRequired) || undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
