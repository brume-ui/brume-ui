import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="br:mb-6 br:flex br:flex-wrap br:items-start br:justify-between br:gap-3">
      <div className="br:min-w-0">
        <h1 className="br:text-2xl br:font-semibold br:text-text">{title}</h1>
        {description ? (
          <p className="br:mt-1 br:text-sm br:text-text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="br:flex br:items-center br:gap-2">{actions}</div> : null}
    </header>
  );
}
