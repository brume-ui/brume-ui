import { Button, IconButton, Popover, useBrume } from '@brume-ui/brume-react';
import type { FilterDef, FilterValue } from '@brume-ui/brume-schema';
import { Funnel } from 'lucide-react';
import { useState } from 'react';
import { useGrid } from '../grid-context';
import { useGridNavigation } from '../use-grid-navigation';
import { FilterInputControl, withFilter } from './filter-input';

/**
 * The funnel in a column header (accent tint, and 「（已套用）」 in its name, while the filter has
 * a value). It opens a popover
 * with just that input; 「套用」 applies the draft, 「清除」 removes the filter.
 */
export function ColumnFilter({ def }: { def: FilterDef }) {
  const { page } = useGrid();
  const { t } = useBrume();
  const { navigate } = useGridNavigation();
  const applied = page.query.filters[def.key];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterValue | undefined>(applied);

  const commit = (value: FilterValue | undefined) => {
    navigate({ filters: withFilter(page.query.filters, def.key, value) });
    setOpen(false);
  };

  return (
    <Popover
      align="end"
      title={def.label}
      open={open}
      onOpenChange={(next) => {
        // Each opening starts from what is applied.
        if (next) setDraft(applied);
        setOpen(next);
      }}
      trigger={
        <IconButton
          icon={Funnel}
          size="sm"
          label={t(applied === undefined ? 'grid.filterColumn' : 'grid.filterColumnActive', {
            label: def.label,
          })}
          active={applied !== undefined}
        />
      }
    >
      <form
        className="br:flex br:flex-col br:gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          commit(draft);
        }}
      >
        <FilterInputControl def={def} value={draft} onChange={setDraft} />
        <div className="br:flex br:justify-end br:gap-2">
          <Button variant="ghost" size="sm" onClick={() => commit(undefined)}>
            {t('grid.clear')}
          </Button>
          <Button type="submit" size="sm">
            {t('grid.apply')}
          </Button>
        </div>
      </form>
    </Popover>
  );
}
