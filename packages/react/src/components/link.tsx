import type { LucideIcon } from 'lucide-react';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { type ButtonSize, type ButtonVariant, buttonClasses } from './button';
import { FOCUS_RING } from './focus';

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'target' | 'rel'> {
  href: string;
  /** 'text' (default): underlined inline text. 'button': a pill with a Button's look. */
  variant?: 'text' | 'button';
  /** The Button look for `variant="button"`. Default 'outline'. */
  buttonVariant?: ButtonVariant;
  /** Size for `variant="button"`. Default 'sm'. */
  size?: ButtonSize;
  /** Opens in a new tab (and says so to screen readers); never goes through the adapter. */
  external?: boolean;
  iconStart?: LucideIcon;
  children: ReactNode;
}

/** True when `href` leaves this origin (an adapter visit could not load it). */
function isCrossOrigin(href: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(href, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

const TEXT =
  'br:inline-flex br:max-w-full br:items-center br:gap-1 br:rounded-[4px] br:text-text br:underline br:decoration-border-strong br:underline-offset-2 br:transition-colors br:duration-fast br:hover:decoration-text';

/**
 * A real `<a href>`: a plain left click on an internal link visits through the adapter, while
 * modified and middle clicks (new tab, new window) stay with the browser. External, download and
 * other-origin links are always native.
 */
export function Link({
  href,
  variant = 'text',
  buttonVariant = 'outline',
  size = 'sm',
  external = false,
  iconStart: Icon,
  onClick,
  children,
  ...rest
}: LinkProps) {
  const { adapter, t } = useBrume();
  const native = external || rest.download !== undefined || isCrossOrigin(href);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      native ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    adapter.visit(href);
  }

  return (
    <a
      {...rest}
      href={href}
      onClick={handleClick}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(variant === 'button' ? buttonClasses(buttonVariant, size) : TEXT, FOCUS_RING)}
    >
      {Icon ? <Icon aria-hidden="true" className="br:size-4 br:shrink-0" /> : null}
      {variant === 'text' ? <span className="br:truncate">{children}</span> : children}
      {external ? <span className="br:sr-only">{t('link.newTab')}</span> : null}
    </a>
  );
}
