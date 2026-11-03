import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="br:mb-5 br:grid br:grid-cols-[minmax(0,1fr)_auto] br:items-start br:gap-x-3 br:gap-y-1">
      <h1 className="br:min-w-0 br:self-center br:text-xl br:leading-7 br:font-semibold br:text-text">
        {title}
      </h1>
      {actions ? <div className="br:flex br:items-center br:gap-2">{actions}</div> : null}
      {description ? (
        <p className="br:col-span-full br:max-w-prose br:line-clamp-2 br:text-sm br:text-text-muted">
          {description}
        </p>
      ) : null}
    </header>
  );
}
