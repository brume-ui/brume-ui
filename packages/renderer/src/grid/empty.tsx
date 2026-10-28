import { Button, type EmptyStateProps, Link, useBrume } from '@brume-ui/brume-react';
import { useGrid } from './grid-context';
import { useGridNavigation } from './use-grid-navigation';

/**
 * What an empty grid says, always with a next step: with a search or filters applied, clearing
 * them; otherwise the page's own empty state (and its action), or the default copy.
 */
export function useGridEmptyState(): Pick<EmptyStateProps, 'title' | 'description' | 'action'> {
  const { page } = useGrid();
  const { t } = useBrume();
  const { navigate } = useGridNavigation();

  if (page.appliedFilters.length > 0 || page.query.q) {
    return {
      title: t('grid.filteredEmptyTitle'),
      description: t('grid.filteredEmptyDescription'),
      action: (
        <Button
          variant="secondary"
          onClick={() => navigate({ q: undefined, scope: undefined, filters: {} })}
        >
          {t('grid.clearFilters')}
        </Button>
      ),
    };
  }

  const { empty } = page;
  const next = empty?.action;
  return {
    title: empty?.title ?? t('renderer.list.emptyTitle'),
    description: empty?.description ?? t('renderer.list.emptyDescription'),
    // A real link, so it can open in a new tab; a plain click still visits through the adapter.
    action: next ? (
      <Link href={next.url} variant="button" buttonVariant="primary" size="md">
        {next.label}
      </Link>
    ) : undefined,
  };
}
