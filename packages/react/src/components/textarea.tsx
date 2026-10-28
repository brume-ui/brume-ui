import type { Ref, TextareaHTMLAttributes } from 'react';
import { cn } from '../cn';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

/** Multi-line text with the TextInput look; it grows from three lines and resizes vertically. */
export function Textarea({
  invalid,
  className,
  rows = 3,
  'aria-invalid': ariaInvalid,
  ...rest
}: TextareaProps) {
  const isInvalid = Boolean(invalid) || ariaInvalid === true || ariaInvalid === 'true';
  return (
    <textarea
      rows={rows}
      {...rest}
      aria-invalid={isInvalid || undefined}
      className={cn(
        CONTROL_BASE,
        'br:block br:h-auto br:w-full br:resize-y br:py-2 br:leading-relaxed',
        isInvalid ? 'br:border-danger' : CONTROL_BORDER,
        FOCUS_RING,
        className,
      )}
    />
  );
}
