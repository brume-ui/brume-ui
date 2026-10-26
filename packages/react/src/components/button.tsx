import { Loader2, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from './focus';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  iconStart?: LucideIcon;
}

const VARIANTS = {
  primary: 'br:bg-accent br:text-text-on-accent br:border-transparent br:hover:brightness-95',
  secondary: 'br:bg-surface br:text-text br:border-border-strong br:hover:bg-surface-canvas',
  ghost: 'br:bg-transparent br:text-text br:border-transparent br:hover:bg-surface-canvas',
  danger: 'br:bg-danger br:text-text-on-accent br:border-transparent br:hover:brightness-95',
} as const;

const SIZES = { sm: 'br:h-8 br:px-3 br:text-sm', md: 'br:h-10 br:px-5 br:text-sm' } as const;

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconStart: Icon,
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
        'br:relative br:inline-flex br:items-center br:justify-center br:gap-2 br:rounded-pill br:border br:font-semibold br:transition-colors br:motion-reduce:transition-none br:disabled:opacity-50 br:disabled:cursor-not-allowed',
        FOCUS_RING,
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {/* Content stays in the layout (hidden while loading) so the width never jumps. */}
      <span className={cn('br:inline-flex br:items-center br:gap-2', loading && 'br:opacity-0')}>
        {Icon ? <Icon aria-hidden="true" className="br:size-4" /> : null}
        {children}
      </span>
      {loading ? (
        <Loader2
          aria-hidden="true"
          className="br:absolute br:size-4 br:animate-spin br:motion-reduce:animate-none"
        />
      ) : null}
    </button>
  );
}
