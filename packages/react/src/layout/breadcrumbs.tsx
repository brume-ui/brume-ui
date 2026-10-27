import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from '../components/focus';
import { useBrume } from '../provider';
import { interceptClick, menuKey } from './menu-utils';

export interface BreadcrumbItem {
  title: string;
  url?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { adapter, t } = useBrume();
  if (items.length === 0) return null;
  return (
    <nav aria-label={t('shell.breadcrumb')} className="br:mb-4">
      <ol className="br:flex br:flex-wrap br:items-center br:gap-1 br:text-sm br:text-text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          const url = item.url;
          return (
            <Fragment key={menuKey(item)}>
              <li className="br:flex br:items-center">
                {last || !url ? (
                  <span
                    aria-current={last ? 'page' : undefined}
                    className={cn(last && 'br:text-text')}
                  >
                    {item.title}
                  </span>
                ) : (
                  <a
                    href={url}
                    onClick={interceptClick(() => adapter.visit(url))}
                    className={cn(
                      'br:rounded-input br:hover:text-text br:hover:underline',
                      FOCUS_RING,
                    )}
                  >
                    {item.title}
                  </a>
                )}
              </li>
              {last ? null : (
                <li aria-hidden="true" className="br:flex br:items-center">
                  <ChevronRight className="br:size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
