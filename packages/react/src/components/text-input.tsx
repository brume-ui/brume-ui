import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '../cn';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function TextInput({
  invalid,
  className,
  type = 'text',
  'aria-invalid': ariaInvalid,
  ...rest
}: TextInputProps) {
  const isInvalid = Boolean(invalid) || ariaInvalid === true || ariaInvalid === 'true';
  return (
    <input
      type={type}
      {...rest}
      aria-invalid={isInvalid || undefined}
      className={cn(
        CONTROL_BASE,
        'br:w-full',
        isInvalid ? 'br:border-danger' : CONTROL_BORDER,
        FOCUS_RING,
        className,
      )}
    />
  );
}
