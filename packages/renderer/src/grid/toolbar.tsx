import {
  ActionMenu,
  Button,
  CheckboxGroup,
  IconButton,
  Popover,
  resolveIcon,
  SearchInput,
  useBrume,
} from '@brume-ui/brume-react';
import { Columns3, Download, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { triggerDownload } from './actions/feedback';
import { useActionRunner } from './actions/run-action';
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
    <div className="br:flex br:flex-wrap br:items-center br:justify-between br:gap-2 br:max-sm:justify-start">
      {/* On phones both halves dissolve into the toolbar's one wrapping row, so the icons wrap
          with the buttons instead of onto a line of their own. */}
      <div className="br:flex br:min-w-0 br:flex-1 br:flex-wrap br:items-center br:gap-2 br:max-sm:contents">
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
      <div className="br:flex br:flex-wrap br:items-center br:gap-1 br:max-sm:contents">
        <div className="br:flex br:flex-wrap br:items-center br:gap-2 br:empty:hidden br:max-sm:contents">
          {end}
        </div>
        {/* The two icons stay together, so neither wraps onto a line alone. */}
        <div className="br:flex br:shrink-0 br:items-center br:gap-1">
          <ColumnToggle hidden={hidden} onHiddenChange={onHiddenChange} />
          <IconButton icon={RefreshCw} label={t('grid.refresh')} onClick={refresh} />
        </div>
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

/** Tool actions (no rows): one button each, before the export menu. */
export function ToolActions() {
  const { page } = useGrid();
  const { run, isRunning } = useActionRunner();
  if (!run || page.actions.tools.length === 0) return null;
  return page.actions.tools.map((def) => (
    <Button
      key={def.key}
      variant={def.tone === 'danger' ? 'danger' : 'secondary'}
      iconStart={def.icon ? resolveIcon(def.icon) : undefined}
      loading={isRunning(def, 'tool', [])}
      onClick={() => void run(def, 'tool', [])}
    >
      {def.label}
    </Button>
  ));
}

export type ExportScope = 'all' | 'page' | 'selected';

/**
 * `export.url` with the current list query, `export_scope` and (for `selected`) `ids[]`.
 * Keys stay readable (`ids[]`, not `ids%5B%5D`); values are encoded.
 */
export function exportHref(
  exportUrl: string,
  currentUrl: string,
  scope: ExportScope,
  ids: ReadonlyArray<string | number> = [],
): string {
  const params = new URL(currentUrl, 'http://localhost').searchParams;
  params.delete('export_scope');
  params.delete('ids[]');
  const parts = [
    params.toString(),
    `export_scope=${scope}`,
    ...(scope === 'selected' ? ids.map((id) => `ids[]=${encodeURIComponent(String(id))}`) : []),
  ].filter(Boolean);
  return `${exportUrl}${exportUrl.includes('?') ? '&' : '?'}${parts.join('&')}`;
}

/** 「匯出 Excel」: all matching rows, this page, or the selected rows; a plain download. */
export function ExportMenu() {
  const { page, selection } = useGrid();
  const { adapter, t } = useBrume();
  const url = page.export?.url;
  if (!url) return null;
  const selectedIds = page.rows.filter((r) => selection.has(String(r.id))).map((r) => r.id);
  const download = (scope: ExportScope) =>
    triggerDownload(exportHref(url, adapter.currentUrl(), scope, selectedIds));
  const label = t('grid.export');
  return (
    <ActionMenu
      label={label}
      trigger={
        <Button variant="secondary" iconStart={Download}>
          {label}
        </Button>
      }
      items={[
        { key: 'all', label: t('grid.exportAll'), onSelect: () => download('all') },
        { key: 'page', label: t('grid.exportPage'), onSelect: () => download('page') },
        ...(selectedIds.length > 0
          ? [
              {
                key: 'selected',
                label: t('grid.exportSelected', { count: selectedIds.length }),
                onSelect: () => download('selected'),
              },
            ]
          : []),
      ]}
    />
  );
}
