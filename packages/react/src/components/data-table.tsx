import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  type CSSProperties,
  Fragment,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { Checkbox } from './checkbox';
import { EmptyState, type EmptyStateProps } from './empty-state';
import { FOCUS_RING } from './focus';
import { Skeleton } from './skeleton';

export interface DataColumn<T> {
  key: string;
  header: string;
  cell?(row: T): ReactNode;
  align?: 'start' | 'end';
  numeric?: boolean;
  /** CSS width (e.g. '8rem', '20%'). Columns without one share the remaining space. */
  width?: string;
  /** Makes the header a button; `direction` is the current state, `onToggle` asks for the next. */
  sort?: { direction: 'asc' | 'desc' | null; onToggle(): void };
  /** Rendered after the header label (e.g. a filter trigger). */
  headerAccessory?: ReactNode;
  /** Hidden columns are not rendered at all. */
  hidden?: boolean;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  getRowId(row: T): string;
  loading?: boolean;
  empty: Pick<EmptyStateProps, 'title' | 'description' | 'action'>;
  caption?: string;
  /** Adds a checkbox column. The header checkbox only acts on the rows of the current page. */
  selection?: {
    selected: ReadonlySet<string>;
    onChange(next: Set<string>): void;
    rowLabel(row: T): string;
  };
  /** Wraps each data row's `<tr>`, e.g. in a RowContextMenu. */
  rowWrapper?(row: T, tr: ReactElement): ReactElement;
  /** A fixed last column of row actions. */
  rowActions?(row: T): ReactNode;
  /** Full-width content under a data row (an expanded detail); return null for none. */
  rowExpansion?(row: T): ReactNode;
}

const SKELETON_ROWS = 5;
/** Rows fade in one after another (30ms apart, capped) when data arrives; decoration only. */
const ROW_STAGGER_MS = 30;
const ROW_STAGGER_MAX = 8;
const ROW_ENTER =
  'br:group/row br:animate-[br-fade-in_var(--br-duration-base)_var(--br-ease-out)_backwards] br:[animation-delay:var(--br-row-delay,0ms)] br:motion-reduce:[animation-delay:0ms]';
/**
 * Floor for columns without a fixed width, so narrow screens scroll instead of squeezing.
 * 10rem leaves 128px of text, enough for a `Y-m-d H:i` timestamp.
 */
const MIN_FLUID_COLUMN = '10rem';
const SELECT_COLUMN_WIDTH = '44px';
const ACTIONS_COLUMN_WIDTH = '10rem';

function minTableWidth(columns: Array<{ width?: string }>, extra: string[]): string {
  const parts = [
    ...extra,
    ...columns.map((c) => (c.width && !c.width.endsWith('%') ? c.width : MIN_FLUID_COLUMN)),
  ];
  return `calc(${parts.join(' + ')})`;
}

/**
 * The selection checkboxes' labels are screen-reader only: no gap after the box, or it would
 * overflow the 20px cell and the cell's ellipsis would paint a stray dot.
 */
const HIDDEN_LABEL_CHECKBOX = 'br:gap-0';

/** True while the element's content is wider than its box (i.e. it scrolls horizontally). */
function useHorizontalOverflow(ref: RefObject<HTMLElement | null>): boolean {
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth);
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    check();
    return () => observer.disconnect();
  }, [ref]);
  return overflows;
}

function alignClass(col: { align?: 'start' | 'end'; numeric?: boolean }) {
  return col.numeric || col.align === 'end' ? 'br:text-right' : 'br:text-left';
}

export function DataTable<T>({
  rows,
  getRowId,
  loading = false,
  empty,
  caption,
  selection,
  rowWrapper,
  rowActions,
  rowExpansion,
  columns: allColumns,
}: DataTableProps<T>) {
  const columns = useMemo(() => allColumns.filter((c) => !c.hidden), [allColumns]);
  const defs = useMemo(
    () =>
      columns.map((col) => ({
        id: col.key,
        header: col.header,
        cell: ({ row }: { row: { original: T } }) =>
          col.cell
            ? col.cell(row.original)
            : String((row.original as Record<string, unknown>)[col.key] ?? ''),
      })),
    [columns],
  );
  const table = useReactTable({
    data: rows,
    columns: defs,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
  });
  const { t } = useBrume();
  const scrollRef = useRef<HTMLDivElement>(null);
  // A scroll container must be reachable by keyboard when it actually scrolls (WCAG 2.1.1).
  const scrolls = useHorizontalOverflow(scrollRef);
  const meta = new Map(columns.map((c) => [c.key, c]));
  const showEmpty = !loading && rows.length === 0;

  const cellBase =
    'br:h-11 br:truncate br:bg-surface br:px-4 br:text-sm br:text-text br:shadow-row br:first:rounded-l-card br:last:rounded-r-card';
  // Hovering a data row shifts its surface a step towards the text colour.
  const rowHover = 'br:transition-colors br:duration-fast br:group-hover/row:bg-(--br-row-hover)';
  // Selected rows take the selected surface (also while hovered); the accent stays on the checkbox.
  const rowSelected = 'br:group-aria-selected/row:bg-surface-selected';
  const stickyActions = 'br:sticky br:right-0';
  // While columns scroll under the sticky actions, they fade out on its left edge instead of
  // showing a sliver of a cut glyph: a shadow in the row's own colour (the cell clips anything
  // else drawn outside it). The negative spread keeps the blur inside the row's height, so
  // nothing shows in the gaps between rows.
  const stickyFade =
    scrolls &&
    'br:shadow-[var(--br-shadow-row),-12px_0_4px_-6px_var(--br-surface)] br:group-hover/row:shadow-[var(--br-shadow-row),-12px_0_4px_-6px_var(--br-row-hover)] br:group-aria-selected/row:shadow-[var(--br-shadow-row),-12px_0_4px_-6px_var(--br-surface-selected)]';
  // The checkbox is 20px in a 44px column: px-3 leaves 12px on each side.
  const selectCell = 'br:px-3';

  const pageIds = rows.map((row) => getRowId(row));
  const selectedOnPage = selection ? pageIds.filter((id) => selection.selected.has(id)).length : 0;
  const allChecked = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const headerChecked = allChecked ? true : selectedOnPage > 0 ? 'indeterminate' : false;
  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    for (const id of pageIds) {
      if (allChecked) next.delete(id);
      else next.add(id);
    }
    selection.onChange(next);
  };
  const toggleRow = (id: string, on: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (on) next.add(id);
    else next.delete(id);
    selection.onChange(next);
  };
  const extraWidths = [
    ...(selection ? [SELECT_COLUMN_WIDTH] : []),
    ...(rowActions ? [ACTIONS_COLUMN_WIDTH] : []),
  ];

  return (
    <div
      ref={scrollRef}
      className={cn('br:overflow-x-auto br:rounded-card', FOCUS_RING)}
      {...(scrolls
        ? {
            tabIndex: 0,
            role: 'region',
            'aria-label': caption ?? t('dataTable.scrollRegion'),
          }
        : {})}
    >
      <table
        aria-busy={loading || undefined}
        className="br:w-full br:table-fixed br:border-separate br:border-spacing-y-1 br:[--br-row-hover:color-mix(in_oklab,var(--br-surface)_96%,var(--br-text))]"
        style={{ minWidth: minTableWidth(columns, extraWidths) }}
      >
        {caption ? <caption className="br:sr-only">{caption}</caption> : null}
        <colgroup>
          {selection ? <col style={{ width: SELECT_COLUMN_WIDTH }} /> : null}
          {columns.map((col) => (
            <col key={col.key} style={col.width ? { width: col.width } : undefined} />
          ))}
          {rowActions ? <col style={{ width: ACTIONS_COLUMN_WIDTH }} /> : null}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {selection ? (
                <th scope="col" className={cn(selectCell, 'br:pb-1')}>
                  <Checkbox
                    checked={headerChecked}
                    onCheckedChange={toggleAll}
                    disabled={loading || pageIds.length === 0}
                    label={<span className="br:sr-only">{t('dataTable.selectAll')}</span>}
                    className={HIDDEN_LABEL_CHECKBOX}
                  />
                </th>
              ) : null}
              {group.headers.map((header) => {
                const col = meta.get(header.column.id);
                const sort = col?.sort;
                const label = flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sort
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : sort.direction === 'desc'
                            ? 'descending'
                            : 'none'
                        : undefined
                    }
                    className={cn(
                      'br:truncate br:px-4 br:pb-1 br:text-xs br:font-semibold br:text-text-muted',
                      alignClass(col ?? {}),
                    )}
                  >
                    <span
                      className={cn(
                        'br:inline-flex br:max-w-full br:items-center br:gap-1',
                        col?.align === 'end' || col?.numeric ? 'br:flex-row-reverse' : null,
                      )}
                    >
                      {sort ? (
                        <button
                          type="button"
                          onClick={sort.onToggle}
                          className={cn(
                            'br:inline-flex br:items-center br:gap-1 br:rounded-[6px] br:font-semibold br:transition-colors br:duration-fast br:hover:text-text',
                            FOCUS_RING,
                          )}
                        >
                          {label}
                          <SortIcons direction={sort.direction} />
                        </button>
                      ) : (
                        label
                      )}
                      {col?.headerAccessory}
                    </span>
                  </th>
                );
              })}
              {rowActions ? (
                // Same colour as the surface behind the header (the canvas, or the Card or Dialog the
                // table sits in, through --br-table-header-bg), so scrolled columns pass under it.
                <th
                  scope="col"
                  className={cn(
                    stickyActions,
                    'br:bg-[var(--br-table-header-bg,var(--br-surface-canvas))] br:px-4 br:pb-1',
                    scrolls &&
                      'br:shadow-[-12px_0_4px_-6px_var(--br-table-header-bg,var(--br-surface-canvas))]',
                  )}
                >
                  <span className="br:sr-only">{t('dataTable.actions')}</span>
                </th>
              ) : null}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
                <tr key={i}>
                  {selection ? <td className={cn(cellBase, selectCell)} /> : null}
                  {columns.map((col) => (
                    <td key={col.key} className={cn(cellBase, alignClass(col))}>
                      <Skeleton className={cn('br:w-3/4', col.numeric && 'br:ml-auto')} />
                    </td>
                  ))}
                  {rowActions ? <td className={cn(cellBase, stickyActions)} /> : null}
                </tr>
              ))
            : table.getRowModel().rows.map((row, i) => {
                const tr = (
                  <tr
                    key={row.id}
                    aria-selected={selection ? selection.selected.has(row.id) : undefined}
                    className={ROW_ENTER}
                    style={
                      {
                        '--br-row-delay': `${Math.min(i, ROW_STAGGER_MAX) * ROW_STAGGER_MS}ms`,
                      } as CSSProperties
                    }
                  >
                    {selection ? (
                      <td className={cn(cellBase, selectCell, rowHover, rowSelected)}>
                        <Checkbox
                          checked={selection.selected.has(row.id)}
                          onCheckedChange={(on) => toggleRow(row.id, on)}
                          className={HIDDEN_LABEL_CHECKBOX}
                          label={
                            <span className="br:sr-only">
                              {t('dataTable.selectRow', {
                                label: selection.rowLabel(row.original),
                              })}
                            </span>
                          }
                        />
                      </td>
                    ) : null}
                    {row.getVisibleCells().map((cell) => {
                      const col = meta.get(cell.column.id);
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            cellBase,
                            rowHover,
                            rowSelected,
                            col && alignClass(col),
                            col?.numeric && 'br:tabular-nums',
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                    {rowActions ? (
                      <td
                        className={cn(
                          cellBase,
                          rowHover,
                          rowSelected,
                          stickyActions,
                          stickyFade,
                          'br:text-right',
                        )}
                      >
                        {rowActions(row.original)}
                      </td>
                    ) : null}
                  </tr>
                );
                const expansion = rowExpansion?.(row.original);
                return (
                  <Fragment key={row.id}>
                    {rowWrapper ? rowWrapper(row.original, tr) : tr}
                    {expansion != null && expansion !== false ? (
                      <tr data-expansion="">
                        <td
                          colSpan={columns.length + (selection ? 1 : 0) + (rowActions ? 1 : 0)}
                          className="br:rounded-card br:bg-surface br:px-4 br:py-3 br:text-sm br:text-text br:shadow-row"
                        >
                          {expansion}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
        </tbody>
      </table>
      {showEmpty ? (
        <div className="br:animate-[br-fade-in_var(--br-duration-base)_var(--br-ease-out)]">
          <EmptyState {...empty} />
        </div>
      ) : null}
    </div>
  );
}

/** Up and down arrows stacked; only the current direction takes the accent colour. */
function SortIcons({ direction }: { direction: 'asc' | 'desc' | null }) {
  return (
    <span aria-hidden="true" className="br:inline-flex br:-space-x-1.5">
      <ArrowUp
        className={cn('br:size-3', direction === 'asc' ? 'br:text-accent' : 'br:opacity-40')}
      />
      <ArrowDown
        className={cn('br:size-3', direction === 'desc' ? 'br:text-accent' : 'br:opacity-40')}
      />
    </span>
  );
}
