import { PillToggleGroup } from '@brume-ui/brume-react';
import { useGrid } from '../grid-context';
import { useGridNavigation } from '../use-grid-navigation';
import { filterList, withFilter } from './filter-input';

/**
 * Above the table, one row of pill options per selector. A single-choice row applies on click
 * (clicking the chosen pill clears it); a multiple-choice row toggles into `filter[key][]`.
 */
export function GridSelectors() {
  const { page } = useGrid();
  const { navigate } = useGridNavigation();
  const selectors = page.selectors ?? [];
  if (selectors.length === 0) return null;
  const { filters } = page.query;
  return (
    <div className="br:flex br:flex-col br:gap-2">
      {selectors.map((s) => (
        <PillToggleGroup
          key={s.key}
          showLabel
          label={s.label}
          multiple={s.multiple}
          options={s.options}
          value={filterList(filters[s.key])}
          onChange={(next) =>
            navigate({
              filters: withFilter(
                filters,
                s.key,
                next.length === 0 ? undefined : s.multiple ? next : next[0],
              ),
            })
          }
        />
      ))}
    </div>
  );
}
