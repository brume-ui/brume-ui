import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
  /** A large muted figure above the title (an error page's status code). */
  code?: string | number;
  /** The title's element: 'p' (default) inside a page, a heading when the state is the page. */
  titleAs?: 'p' | 'h1' | 'h2';
}

/** Explains why nothing is shown and offers the next step. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  code,
  titleAs: Title = 'p',
}: EmptyStateProps) {
  return (
    <div className="br:flex br:flex-col br:items-center br:gap-2 br:px-6 br:py-12 br:text-center">
      {Icon ? <Icon aria-hidden="true" className="br:mb-2 br:size-8 br:text-text-muted" /> : null}
      {code !== undefined ? (
        <p className="br:mb-1 br:text-5xl br:font-semibold br:leading-none br:tracking-tight br:text-text-muted br:tabular-nums">
          {code}
        </p>
      ) : null}
      <Title
        className={cn(
          'br:font-semibold br:text-text',
          Title === 'p' ? 'br:text-base' : 'br:text-xl',
        )}
      >
        {title}
      </Title>
      <p className="br:max-w-sm br:text-sm br:text-text-muted">{description}</p>
      {action ? <div className="br:mt-3">{action}</div> : null}
    </div>
  );
}
