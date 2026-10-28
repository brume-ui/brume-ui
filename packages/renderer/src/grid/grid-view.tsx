import {
  type DataColumn,
  DataTable,
  PageHeader,
  Pagination,
  Select,
  useBrume,
} from '@brume-ui/brume-react';
import type { GridRow, ListColumn, ListPage } from '@brume-ui/brume-schema';
import { type ReactNode, useMemo, useState } from 'react';
import { ComponentSlot } from '../component-slot';
import { readHiddenColumns, writeHiddenColumns } from './column-visibility';
import { useGridEmptyState } from './empty';
import { GridContext, type GridContextValue, useGrid } from './grid-context';
import { GridToolbar } from './toolbar';
import { GRID_VISIT, hrefForPage, useGridNavigation } from './use-grid-navigation';

export interface GridViewProps {
  page: ListPage;
  /** Opens a row for editing (sub-plan 2 swaps in a form dialog). */
  onEdit?(row: GridRow): void;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Task 10 replaces this with renderCell(column, row), dispatching on display.type.
function renderCell(col: ListColumn, row: GridRow): ReactNode {
  if (col.display?.type === 'component') {
    return <ComponentSlot ref={col.display} context={{ row, column: col.key }} />;
  }
  return formatCell(row[col.key]);
}

/** One list page: toolbar, table and pagination, all driven by the URL (see useGridNavigation). */
export function GridView({ page, onEdit }: GridViewProps) {
  const [hidden, setHidden] = useState(() => readHiddenColumns(page));
  const [hiddenFor, setHiddenFor] = useState(page.gridId);
  if (hiddenFor !== page.gridId) {
    setHiddenFor(page.gridId);
    setHidden(readHiddenColumns(page));
  }
  const changeHidden = (next: Set<string>) => {
    setHidden(next);
    writeHiddenColumns(page.gridId, next);
  };

  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set());
  const grid = useMemo<GridContextValue>(
    () => ({ page, selection, setSelection, onEdit }),
    [page, selection, onEdit],
  );

  return (
    <GridContext.Provider value={grid}>
      <div className="br:flex br:flex-col br:gap-4">
        <PageHeader title={page.title} description={page.description} />
        {/* Task 11: the batch bar (shown while rows are selected) goes above the toolbar. */}
        <GridToolbar hidden={hidden} onHiddenChange={changeHidden} />
        {/* Task 9: the filter panel opens here, then selectors sit above the table. */}
        <GridTable hidden={hidden} />
        <GridFooter />
      </div>
    </GridContext.Provider>
  );
}

function GridTable({ hidden }: { hidden: ReadonlySet<string> }) {
  const { page } = useGrid();
  const { navigate } = useGridNavigation();
  const empty = useGridEmptyState();
  const sort = page.query.sort;

  const columns = useMemo<DataColumn<GridRow>[]>(
    () =>
      page.columns.map((col) => ({
        key: col.key,
        header: col.label,
        numeric: col.numeric,
        width: col.width,
        hidden: hidden.has(col.key),
        cell: (row) => renderCell(col, row),
        // Unsorted → ascending → descending → unsorted.
        sort: col.sortable
          ? {
              direction: sort?.key === col.key ? sort.direction : null,
              onToggle: () => {
                const current = sort?.key === col.key ? sort.direction : null;
                navigate({
                  sort:
                    current === null
                      ? { key: col.key, direction: 'asc' }
                      : current === 'asc'
                        ? { key: col.key, direction: 'desc' }
                        : undefined,
                });
              },
            }
          : undefined,
        // Task 9: headerAccessory for column filters.
      })),
    [page.columns, hidden, sort, navigate],
  );

  return (
    <DataTable
      columns={columns}
      rows={page.rows}
      getRowId={(row) => String(row.id)}
      caption={page.title}
      empty={empty}
      // Task 11: selection, rowWrapper (context menu) and rowActions.
    />
  );
}

function GridFooter() {
  const { page } = useGrid();
  const { adapter, t } = useBrume();
  const { navigate } = useGridNavigation();
  const { pagination } = page;
  // The current size stays selectable even when the server allows a size outside the options.
  const sizes = [...new Set([...page.perPageOptions, pagination.perPage])].sort((a, b) => a - b);
  const showSizes = sizes.length > 1;
  if (!showSizes && pagination.lastPage <= 1) return null;
  return (
    <div className="br:flex br:flex-wrap br:items-center br:justify-end br:gap-3">
      {showSizes ? (
        <div className="br:w-36">
          <Select
            aria-label={t('grid.perPageLabel')}
            value={String(pagination.perPage)}
            options={sizes.map((n) => ({ value: String(n), label: t('grid.perPage', { n }) }))}
            onValueChange={(value) => navigate({ perPage: Number(value) })}
          />
        </div>
      ) : null}
      <Pagination
        page={pagination.page}
        lastPage={pagination.lastPage}
        hrefFor={(n) => hrefForPage(adapter.currentUrl(), n)}
        onNavigate={(href) => adapter.visit(href, GRID_VISIT)}
      />
    </div>
  );
}
