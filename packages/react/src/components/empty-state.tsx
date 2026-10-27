import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}

/** Explains why nothing is shown and offers the next step. */
export function EmptyState({ title, description, action, icon: Icon }: EmptyStateProps) {
  return (
    <div className="br:flex br:flex-col br:items-center br:gap-2 br:px-6 br:py-12 br:text-center">
      {Icon ? <Icon aria-hidden="true" className="br:mb-2 br:size-8 br:text-text-muted" /> : null}
      <p className="br:text-base br:font-semibold br:text-text">{title}</p>
      <p className="br:max-w-sm br:text-sm br:text-text-muted">{description}</p>
      {action ? <div className="br:mt-3">{action}</div> : null}
    </div>
  );
}
