import { Button, Chip, useBrume } from '@brume-ui/brume-react';
import { useGrid } from '../grid-context';
import { useGridNavigation } from '../use-grid-navigation';
import { withFilter } from './filter-input';

/**
 * One chip per applied filter (including `scope` and `q`); ✕ drops that key from the URL. With
 * more than one chip, 「清除所有篩選」 drops them all.
 */
export function FilterChips() {
  const { page } = useGrid();
  const { t } = useBrume();
  const { navigate } = useGridNavigation();
  const applied = page.appliedFilters;
  if (applied.length === 0) return null;

  const remove = (key: string) => {
    if (key === 'q') navigate({ q: undefined });
    else if (key === 'scope') navigate({ scope: undefined });
    else navigate({ filters: withFilter(page.query.filters, key, undefined) });
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would add a form-group border and legend.
    <div
      role="group"
      aria-label={t('grid.appliedFilters')}
      className="br:flex br:flex-wrap br:items-center br:gap-2"
    >
      {applied.map((f) => (
        <Chip
          key={f.key}
          label={f.label}
          value={f.display}
          removeLabel={t('chip.removeFilter', { label: f.label })}
          onRemove={() => remove(f.key)}
        />
      ))}
      {applied.length > 1 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ q: undefined, scope: undefined, filters: {} })}
        >
          {t('grid.clearFilters')}
        </Button>
      ) : null}
    </div>
  );
}
