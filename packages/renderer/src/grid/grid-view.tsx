import {
  type DataColumn,
  DataTable,
  PageHeader,
  Pagination,
  Select,
  useBrume,
} from '@brume-ui/brume-react';
import type { GridRow, ListPage } from '@brume-ui/brume-schema';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { BatchBar } from './actions/batch-bar';
import { hasRowActions, PrimaryCell, RowActions, RowMenu, rowLabel } from './actions/row-actions';
import { readHiddenColumns, writeHiddenColumns } from './column-visibility';
import { RowExpansion, renderCell } from './displays';
import { useGridEmptyState } from './empty';
import { ColumnFilter } from './filters/column-filter';
import { FilterChips } from './filters/filter-chips';
import { FilterPanelToggle, FilterPanelView } from './filters/filter-panel';
import { GridScopes } from './filters/scopes';
import { GridSelectors } from './filters/selectors';
import { GridContext, type GridContextValue, useGrid } from './grid-context';
import { ExportMenu, GridToolbar, ToolActions } from './toolbar';
import { GRID_VISIT, hrefForPage, useGridNavigation } from './use-grid-navigation';

export interface GridViewProps {
  page: ListPage;
  /** Opens a row for editing (sub-plan 2 swaps in a form dialog). */
  onEdit?(row: GridRow): void;
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
  // Another view of the list (grid, sort, filters, search, scope, page size or page) starts with
  // nothing selected; new rows for the same view (a refresh) keep the ids that are still there.
  const viewKey = JSON.stringify([page.gridId, page.query, page.pagination.page]);
  const [selectionFor, setSelectionFor] = useState({ viewKey, rows: page.rows });
  if (selectionFor.viewKey !== viewKey) {
    setSelectionFor({ viewKey, rows: page.rows });
    if (selection.size > 0) setSelection(new Set());
  } else if (selectionFor.rows !== page.rows) {
    setSelectionFor({ viewKey, rows: page.rows });
    const present = new Set(page.rows.map((row) => String(row.id)));
    const kept = [...selection].filter((id) => present.has(id));
    if (kept.length !== selection.size) setSelection(new Set(kept));
  }

  // Open `expand` cells, keyed "rowId␀columnKey".
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const expansionPrefix = useId();
  const toggleExpanded = useCallback((rowId: string, key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const id = `${rowId}\u0000${key}`;
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const expansionId = useCallback(
    (rowId: string, key: string) =>
      `${expansionPrefix}-${encodeURIComponent(rowId)}-${encodeURIComponent(key)}`,
    [expansionPrefix],
  );

  // Actions in flight. The ref answers at once (a second click in the same tick sees the first);
  // the state re-renders the buttons and menus.
  const running = useRef(new Set<string>());
  const [runningActions, setRunningActions] = useState<ReadonlySet<string>>(() => new Set());
  const startAction = useCallback((key: string) => {
    if (running.current.has(key)) return false;
    running.current.add(key);
    setRunningActions(new Set(running.current));
    return true;
  }, []);
  const endAction = useCallback((key: string) => {
    if (!running.current.delete(key)) return;
    setRunningActions(new Set(running.current));
  }, []);

  const grid = useMemo<GridContextValue>(
    () => ({
      page,
      selection,
      setSelection,
      onEdit,
      isExpanded: (rowId, key) => expanded.has(`${rowId}\u0000${key}`),
      toggleExpanded,
      expansionId,
      runningActions,
      startAction,
      endAction,
    }),
    [
      page,
      selection,
      onEdit,
      expanded,
      toggleExpanded,
      expansionId,
      runningActions,
      startAction,
      endAction,
    ],
  );

  const filterPanelId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <GridContext.Provider value={grid}>
      <div className="br:flex br:flex-col br:gap-4">
        <PageHeader title={page.title} description={page.description} />
        <BatchBar />
        <GridToolbar
          hidden={hidden}
          onHiddenChange={changeHidden}
          start={
            <>
              <GridScopes />
              <FilterPanelToggle
                open={filtersOpen}
                onToggle={() => setFiltersOpen((open) => !open)}
                panelId={filterPanelId}
              />
            </>
          }
          end={
            <>
              <ToolActions />
              <ExportMenu />
            </>
          }
        />
        <FilterPanelView id={filterPanelId} open={filtersOpen} />
        <FilterChips />
        <GridSelectors />
        <GridTable hidden={hidden} />
        <GridFooter />
      </div>
    </GridContext.Provider>
  );
}

function GridTable({ hidden }: { hidden: ReadonlySet<string> }) {
  const { page, isExpanded, selection, setSelection, onEdit } = useGrid();
  const { navigate } = useGridNavigation();
  const empty = useGridEmptyState();
  const sort = page.query.sort;
  const { columnFilters } = page;

  const columns = useMemo<DataColumn<GridRow>[]>(
    () =>
      page.columns.map((col) => ({
        key: col.key,
        header: col.label,
        numeric: col.numeric,
        width: col.width,
        hidden: hidden.has(col.key),
        cell: (row) =>
          col.primary ? <PrimaryCell column={col} row={row} /> : renderCell(col, row),
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
        headerAccessory: (() => {
          const def = col.filter ? columnFilters?.find((f) => f.key === col.filter) : undefined;
          return def ? <ColumnFilter def={def} /> : undefined;
        })(),
      })),
    [page.columns, columnFilters, hidden, sort, navigate],
  );

  const expandColumns = page.columns.filter(
    (col) => col.display?.type === 'expand' && !hidden.has(col.key),
  );
  const rowExpansion = (row: GridRow) => {
    const open = expandColumns.filter(
      (col) => row._meta?.content?.[col.key] && isExpanded(String(row.id), col.key),
    );
    return open.length > 0 ? <RowExpansion row={row} columns={open} /> : null;
  };

  const runnable = Boolean(page.endpoints?.action);
  // Checkboxes only when something acts on a selection: batch actions or 「已選取的 N 筆」 export.
  const selectable = (runnable && page.actions.batch.length > 0) || Boolean(page.export);
  const canEdit = Boolean(onEdit) || page.rows.some((row) => row._meta?.editUrl);
  const withRowActions = hasRowActions(page, canEdit);

  return (
    <DataTable
      columns={columns}
      rows={page.rows}
      getRowId={(row) => String(row.id)}
      caption={page.title}
      empty={empty}
      rowExpansion={expandColumns.length > 0 ? rowExpansion : undefined}
      selection={
        selectable
          ? {
              selected: selection,
              onChange: setSelection,
              rowLabel: (row) => rowLabel(page, row),
            }
          : undefined
      }
      rowWrapper={(row, tr) => <RowMenu row={row}>{tr}</RowMenu>}
      rowActions={withRowActions ? (row) => <RowActions row={row} /> : undefined}
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
