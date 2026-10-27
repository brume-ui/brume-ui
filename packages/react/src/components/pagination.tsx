import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { FOCUS_RING } from './focus';

export interface PaginationProps {
  page: number;
  lastPage: number;
  hrefFor(page: number): string;
  onNavigate?(href: string): void;
}

type Item = number | 'gap';

/** First, last, current +/- 1; any hidden run becomes a single ellipsis. */
export function pageItems(page: number, lastPage: number): Item[] {
  const keep = new Set([1, lastPage, page - 1, page, page + 1]);
  const pages = [...keep].filter((n) => n >= 1 && n <= lastPage).sort((a, b) => a - b);
  const items: Item[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - (pages[i - 1] as number) > 1) items.push('gap');
    items.push(n);
  });
  return items;
}

const PILL =
  'br:inline-flex br:h-9 br:min-w-9 br:items-center br:justify-center br:rounded-pill br:px-3 br:text-sm br:font-semibold br:transition-colors br:motion-reduce:transition-none';

export function Pagination({ page, lastPage, hrefFor, onNavigate }: PaginationProps) {
  const { t } = useBrume();
  if (lastPage <= 1) return null;

  const click = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) return;
    // Let the browser handle new-tab / modified clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onNavigate(href);
  };

  const step = (target: number, disabled: boolean, label: string, icon: ReactNode) =>
    disabled ? (
      <span
        aria-disabled="true"
        className={cn(PILL, 'br:cursor-not-allowed br:text-text-muted br:opacity-50')}
      >
        {icon}
        <span className="br:sr-only">{label}</span>
      </span>
    ) : (
      <a
        href={hrefFor(target)}
        onClick={click(hrefFor(target))}
        className={cn(PILL, 'br:text-text br:hover:bg-surface-canvas', FOCUS_RING)}
      >
        {icon}
        <span className="br:sr-only">{label}</span>
      </a>
    );

  return (
    <nav aria-label={t('pagination.label')}>
      <ul className="br:inline-flex br:items-center br:gap-1 br:rounded-pill br:bg-surface br:p-1 br:shadow-row">
        <li>
          {step(
            page - 1,
            page <= 1,
            t('pagination.previous'),
            <ChevronLeft aria-hidden="true" className="br:size-4" />,
          )}
        </li>
        {pageItems(page, lastPage).map((item, i) =>
          item === 'gap' ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: at most two gaps, position is identity
            <li key={`gap-${i}`} aria-hidden="true" className="br:px-1 br:text-text-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <a
                href={hrefFor(item)}
                onClick={click(hrefFor(item))}
                aria-label={t('pagination.page', { page: item })}
                aria-current={item === page ? 'page' : undefined}
                className={cn(
                  PILL,
                  'br:tabular-nums',
                  item === page
                    ? 'br:bg-accent br:text-text-on-accent'
                    : 'br:text-text br:hover:bg-surface-canvas',
                  FOCUS_RING,
                )}
              >
                {item}
              </a>
            </li>
          ),
        )}
        <li>
          {step(
            page + 1,
            page >= lastPage,
            t('pagination.next'),
            <ChevronRight aria-hidden="true" className="br:size-4" />,
          )}
        </li>
      </ul>
    </nav>
  );
}
