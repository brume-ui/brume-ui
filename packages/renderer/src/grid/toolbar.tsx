import { CheckboxGroup, IconButton, Popover, SearchInput, useBrume } from '@brume-ui/brume-react';
import { Columns3, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGrid } from './grid-context';
import { useGridNavigation } from './use-grid-navigation';

export interface GridToolbarProps {
  hidden: ReadonlySet<string>;
  onHiddenChange(next: Set<string>): void;
  /** After quick search: the filter button and applied-filter chips (Task 9). */
  start?: ReactNode;
  /** Before the column toggle: tool actions and export (Task 11). */
  end?: ReactNode;
}

/**
 * Left: quick search → `start`. Right: `end` → column toggle → refresh. Wraps onto two lines on
 * narrow screens.
 */
export function GridToolbar({ hidden, onHiddenChange, start, end }: GridToolbarProps) {
  const { page } = useGrid();
  const { t } = useBrume();
  const { navigate, refresh } = useGridNavigation();
  return (
    <div className="br:flex br:flex-wrap br:items-center br:justify-between br:gap-2">
      <div className="br:flex br:min-w-0 br:flex-1 br:flex-wrap br:items-center br:gap-2">
        {page.quickSearch ? (
          <div className="br:w-full br:sm:w-72">
            <SearchInput
              value={page.query.q ?? ''}
              onSearch={(q) => navigate({ q: q || undefined })}
              placeholder={page.quickSearch.placeholder ?? t('grid.search')}
              label={t('grid.search')}
            />
          </div>
        ) : null}
        {start}
      </div>
      <div className="br:flex br:items-center br:gap-1">
        {end}
        <ColumnToggle hidden={hidden} onHiddenChange={onHiddenChange} />
        <IconButton icon={RefreshCw} label={t('grid.refresh')} onClick={refresh} />
      </div>
    </div>
  );
}

function ColumnToggle({ hidden, onHiddenChange }: Omit<GridToolbarProps, 'start' | 'end'>) {
  const { page } = useGrid();
  const { t } = useBrume();
  const label = t('grid.columns');
  return (
    <Popover align="end" title={label} trigger={<IconButton icon={Columns3} label={label} />}>
      <CheckboxGroup
        label={label}
        orientation="vertical"
        options={page.columns.map((c) => ({
          value: c.key,
          label: c.label,
          disabled: c.hideable === false,
        }))}
        value={page.columns.filter((c) => !hidden.has(c.key)).map((c) => c.key)}
        onChange={(visible) => {
          const shown = new Set(visible);
          onHiddenChange(
            new Set(
              page.columns
                .filter((c) => c.hideable !== false && !shown.has(c.key))
                .map((c) => c.key),
            ),
          );
        }}
      />
    </Popover>
  );
}
