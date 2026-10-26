import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from '../cn';
import { CONTROL_BASE, FOCUS_RING } from './focus';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function TextInput({ invalid, className, type = 'text', ...rest }: TextInputProps) {
  return (
    <input
      type={type}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
      {...rest}
      className={cn(
        CONTROL_BASE,
        'br:w-full',
        invalid || rest['aria-invalid'] === true || rest['aria-invalid'] === 'true'
          ? 'br:border-danger'
          : 'br:border-border-strong',
        FOCUS_RING,
        className,
      )}
    />
  );
}
