import { Loader2, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn';
import { PRESS } from '../motion/classes';
import { FOCUS_RING } from './focus';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `outline` is the tinted pill outline of exposed row actions (row-actions mockup B). */
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconStart?: LucideIcon;
  /** A number after the label in the accent colour (how many filters are applied); hidden at 0. */
  count?: number;
}

const VARIANTS = {
  primary: 'br:bg-accent br:text-text-on-accent br:border-transparent br:hover:brightness-95',
  secondary: 'br:bg-surface br:text-text br:border-border-strong br:hover:bg-surface-canvas',
  outline:
    'br:bg-surface br:text-accent-tint-text br:border-[color-mix(in_oklab,var(--br-accent)_35%,var(--br-surface))] br:hover:bg-accent-tint',
  ghost: 'br:bg-transparent br:text-text br:border-transparent br:hover:bg-surface-canvas',
  danger: 'br:bg-danger br:text-text-on-accent br:border-transparent br:hover:brightness-95',
} as const;

const SIZES = { sm: 'br:h-8 br:px-3 br:text-sm', md: 'br:h-10 br:px-5 br:text-sm' } as const;

/** The pill look of a Button, shared with button-styled links. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return cn(
    'br:relative br:inline-flex br:items-center br:justify-center br:gap-2 br:rounded-pill br:border br:font-semibold',
    PRESS,
    FOCUS_RING,
    VARIANTS[variant],
    SIZES[size],
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconStart: Icon,
  count,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        buttonClasses(variant, size),
        'br:disabled:opacity-50 br:disabled:cursor-not-allowed',
        className,
      )}
    >
      {/* Content stays in the layout (hidden while loading) so the width never jumps. */}
      <span
        className={cn(
          'br:inline-flex br:items-center br:gap-2 br:transition-[opacity,filter] br:duration-fade br:ease-out',
          loading && 'br:opacity-0 br:blur-[2px]',
        )}
      >
        {Icon ? <Icon aria-hidden="true" className="br:size-4" /> : null}
        {children}
        {count ? (
          <span data-count="" className="br:text-accent br:tabular-nums">
            {count}
          </span>
        ) : null}
      </span>
      {loading ? (
        // Fades in over the hidden label; the spin itself stops under reduced motion.
        <span className="br:absolute br:inline-flex br:animate-[br-fade-in_var(--br-duration-fade)_var(--br-ease-out)]">
          <Loader2
            aria-hidden="true"
            className="br:size-4 br:animate-spin br:motion-reduce:animate-none"
          />
        </span>
      ) : null}
    </button>
  );
}
