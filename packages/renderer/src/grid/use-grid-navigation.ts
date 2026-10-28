import { useBrume, type VisitOptions } from '@brume-ui/brume-react';
import { type GridQuery, withGridQuery } from '@brume-ui/brume-schema';
import { useMemo } from 'react';

/** List state changes only re-fetch the page envelope and keep scroll and component state. */
export const GRID_VISIT: VisitOptions = {
  preserveScroll: true,
  preserveState: true,
  only: ['envelope'],
};

/**
 * The URL is the list state. `navigate` merges a patch into the current URL (any change other
 * than `page` goes back to page 1) and visits it; `refresh` reloads the envelope in place.
 */
export function useGridNavigation(): {
  navigate(patch: Partial<GridQuery>): void;
  refresh(): void;
} {
  const { adapter } = useBrume();
  return useMemo(
    () => ({
      navigate: (patch) => adapter.visit(withGridQuery(adapter.currentUrl(), patch), GRID_VISIT),
      refresh: () => adapter.reload({ only: ['envelope'] }),
    }),
    [adapter],
  );
}

/** The current URL at another page, keeping every other parameter (and the hash). */
export function hrefForPage(currentUrl: string, page: number): string {
  return withGridQuery(currentUrl, { page });
}
