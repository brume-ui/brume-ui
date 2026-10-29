import { TextInput } from './text-input';

export interface DateInputProps {
  /** `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` with `withTime`; '' when empty. */
  value: string;
  onChange(value: string): void;
  /** Native `datetime-local` instead of `date`. */
  withTime?: boolean;
  /** Accessible name of the field. */
  label: string;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
}

/**
 * Native date / datetime-local field styled like TextInput. It stays native on purpose (no custom
 * calendar): zero dependencies, the best mobile pickers, and keyboard and screen-reader support
 * that the browser owns. A custom calendar will be considered after people have tried this one.
 *
 * The browser's calendar and picker icon follow dark mode through the inherited `color-scheme`
 * that tokens.css sets on `:root` per theme (light / dark, including the manual switch). A local `color-scheme: light dark` would instead
 * follow the OS preference and draw a light-scheme picker inside a manually darkened page.
 */
export function DateInput({ value, onChange, withTime, label, ...rest }: DateInputProps) {
  return (
    <TextInput
      {...rest}
      type={withTime ? 'datetime-local' : 'date'}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
