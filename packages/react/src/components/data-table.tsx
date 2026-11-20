import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { prefersReducedMotion } from '../motion/reduced-motion';
import { useBrume } from '../provider';
import { Checkbox } from './checkbox';
import { DragHandle } from './drag-handle';
import { EmptyState, type EmptyStateProps } from './empty-state';
import { FOCUS_RING } from './focus';
import { Skeleton } from './skeleton';
import { useSortableSetup } from './use-sortable-setup';

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
  /**
   * Adds a drag-handle column left of the checkbox. Dropping a row calls `onMove` with its new
   * neighbour: `after` the row now above it, or `before` the row now below it when it reached
   * the top (never both). The table shows the new order until `rows` changes, or until the
   * promise `onMove` may return rejects (the move failed: the old order comes back).
   */
  reorder?: {
    /** false greys the handles out and shows `disabledReason` as their tooltip. */
    enabled: boolean;
    disabledReason?: string;
    // biome-ignore lint/suspicious/noConfusingVoidType: plain void handlers must stay assignable
    onMove(move: { id: string; before?: string; after?: string }): void | Promise<unknown>;
  };
}

const SKELETON_ROWS = 5;
/** Rows appear at once: no per-row enter animation, so a page of data reads as one block. */
const ROW = 'br:group/row';
/**
 * Floor for columns without a fixed width, so narrow screens scroll instead of squeezing.
 * 10rem leaves 128px of text, enough for a `Y-m-d H:i` timestamp.
 */
const MIN_FLUID_COLUMN = '10rem';
const SELECT_COLUMN_WIDTH = '44px';
const HANDLE_COLUMN_WIDTH = '44px';
/** The 28px handle plus this padding must fit the column, or the cell's ellipsis draws a stray dot. */
const HANDLE_CELL = 'br:px-2';
/**
 * A lifted row: an accent tint on its cells and one drop shadow around the whole row (a shadow per
 * cell would show seams between the cells). The drop line is an accent inset edge on
 * the cells of the row being hovered. Motion is dnd-kit's transform, switched off under reduced
 * motion in SortableRow.
 */
const DRAG_STATES = [
  'br:data-dragging:*:bg-accent-tint br:data-dragging:*:shadow-none br:data-dragging:[filter:drop-shadow(0_10px_12px_rgba(15,21,28,0.16))]',
  'br:data-[drop=before]:*:shadow-[inset_0_2px_0_var(--br-accent),var(--br-shadow-row)]',
  'br:data-[drop=after]:*:shadow-[inset_0_-2px_0_var(--br-accent),var(--br-shadow-row)]',
].join(' ');
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

/**
 * Whether the element's content is wider than its box (it scrolls horizontally), and whether
 * some of it is still out of view on the end side.
 */
function useHorizontalOverflow(ref: RefObject<HTMLElement | null>): {
  overflows: boolean;
  moreAtEnd: boolean;
} {
  const [state, setState] = useState({ overflows: false, moreAtEnd: false });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => {
      const overflows = el.scrollWidth > el.clientWidth;
      const moreAtEnd = overflows && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setState((prev) =>
        prev.overflows === overflows && prev.moreAtEnd === moreAtEnd
          ? prev
          : { overflows, moreAtEnd },
      );
    };
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    el.addEventListener('scroll', check, { passive: true });
    check();
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', check);
    };
  }, [ref]);
  return state;
}

function alignClass(col: { align?: 'start' | 'end'; numeric?: boolean }) {
  return col.numeric || col.align === 'end' ? 'br:text-right' : 'br:text-left';
}

interface SortableState {
  dragging: boolean;
  /** Where the drop line goes while another row hovers this one. */
  drop: 'before' | 'after' | null;
  handleProps: Record<string, unknown>;
  setHandleRef(node: HTMLElement | null): void;
}

/**
 * Calls useSortable for one row and hands its state to `children`, which builds the `<tr>`
 * (so rowWrapper still receives a plain element).
 */
function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children(
    state: SortableState,
    rowProps: { ref(node: HTMLElement | null): void; style: CSSProperties },
  ): ReactElement;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    index,
    activeIndex,
  } = useSortable({ id, disabled, transition: prefersReducedMotion() ? null : undefined });
  const drop = isOver && !isDragging ? (activeIndex < index ? 'after' : 'before') : null;
  return children(
    {
      dragging: isDragging,
      drop,
      handleProps: disabled ? {} : { ...attributes, ...listeners },
      setHandleRef: setActivatorNodeRef,
    },
    {
      ref: setNodeRef,
      style: {
        transform: CSS.Translate.toString(transform),
        transition: prefersReducedMotion() ? undefined : transition,
        position: isDragging ? 'relative' : undefined,
        zIndex: isDragging ? 10 : undefined,
      },
    },
  );
}

/** A human name for a row: the selection label, else its first visible text value, else its id. */
function rowName<T>(row: T, id: string, labelOf: ((row: T) => string) | undefined, keys: string[]) {
  if (labelOf) return labelOf(row);
  for (const key of keys) {
    const value = (row as Record<string, unknown>)[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return id;
}

export function DataTable<T>({
  rows: rowsProp,
  getRowId,
  loading = false,
  empty,
  caption,
  selection,
  rowWrapper,
  rowActions,
  rowExpansion,
  reorder,
  columns: allColumns,
}: DataTableProps<T>) {
  // The optimistic order lives only as long as the `rows` array it was made from.
  const [optimistic, setOptimistic] = useState<{ base: T[]; list: T[] } | null>(null);
  const rows = optimistic && optimistic.base === rowsProp ? optimistic.list : rowsProp;
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
  const textKeys = columns.map((c) => c.key);
  const nameOf = (id: string) => {
    const row = rows.find((r) => getRowId(r) === id);
    return row === undefined ? id : rowName(row, id, selection?.rowLabel, textKeys);
  };
  const positionOf = (id: string) => rows.findIndex((r) => getRowId(r) === id) + 1;
  const dnd = useSortableSetup(nameOf, positionOf);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!reorder || !over || active.id === over.id) return;
    const from = rows.findIndex((r) => getRowId(r) === active.id);
    const to = rows.findIndex((r) => getRowId(r) === over.id);
    if (from < 0 || to < 0 || from === to) return;
    const list = arrayMove(rows, from, to);
    const mine = { base: rowsProp, list };
    setOptimistic(mine);
    const above = list[to - 1];
    const below = list[to + 1];
    const id = String(active.id);
    const result =
      above !== undefined
        ? reorder.onMove({ id, after: getRowId(above) })
        : below !== undefined
          ? reorder.onMove({ id, before: getRowId(below) })
          : undefined;
    // A failed move drops the optimistic order (with any move stacked on it before fresh rows
    // arrived), even when no fresh rows ever arrive.
    if (result && typeof result.then === 'function')
      result.then(undefined, () => setOptimistic((cur) => (cur?.base === mine.base ? null : cur)));
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  // A scroll container must be reachable by keyboard when it actually scrolls (WCAG 2.1.1).
  const { overflows: scrolls, moreAtEnd } = useHorizontalOverflow(scrollRef);
  const meta = new Map(columns.map((c) => [c.key, c]));
  const showEmpty = !loading && rows.length === 0;

  const cellBase =
    'br:h-11 br:truncate br:bg-surface br:px-4 br:text-sm br:text-text br:shadow-row br:first:rounded-l-card br:last:rounded-r-card';
  // Hovering a data row shifts its surface a step towards the text colour.
  const rowHover = 'br:transition-colors br:duration-fast br:group-hover/row:bg-(--br-row-hover)';
  // Selected rows take the selected surface (also while hovered); the accent stays on the checkbox.
  const rowSelected = 'br:group-aria-selected/row:bg-surface-selected';
  const stickyActions = 'br:sticky br:right-0';
  // While more columns wait on the right, a hairline on the sticky column's left edge says the
  // row goes on under it (the fade alone reads as the row's end).
  const moreColumns =
    'br:data-more-columns:before:absolute br:data-more-columns:before:inset-y-3 br:data-more-columns:before:left-0 br:data-more-columns:before:w-px br:data-more-columns:before:bg-border';
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
    ...(reorder ? [HANDLE_COLUMN_WIDTH] : []),
    ...(selection ? [SELECT_COLUMN_WIDTH] : []),
    ...(rowActions ? [ACTIONS_COLUMN_WIDTH] : []),
  ];

  const wrapDnd = (node: ReactElement) =>
    reorder ? (
      <DndContext {...dnd} onDragEnd={onDragEnd}>
        <SortableContext
          items={rows.map((r) => getRowId(r))}
          strategy={verticalListSortingStrategy}
        >
          {node}
        </SortableContext>
      </DndContext>
    ) : (
      node
    );

  return wrapDnd(
    <div
      ref={scrollRef}
      // relative: visually hidden text (sr-only is absolute) in off-screen columns is positioned
      // against this scroller, so it cannot widen the page.
      className={cn('br:relative br:overflow-x-auto br:rounded-card', FOCUS_RING)}
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
          {reorder ? <col style={{ width: HANDLE_COLUMN_WIDTH }} /> : null}
          {selection ? <col style={{ width: SELECT_COLUMN_WIDTH }} /> : null}
          {columns.map((col) => (
            <col key={col.key} style={col.width ? { width: col.width } : undefined} />
          ))}
          {rowActions ? <col style={{ width: ACTIONS_COLUMN_WIDTH }} /> : null}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {reorder ? (
                <th scope="col" className="br:px-3 br:pb-1">
                  <span className="br:sr-only">{t('dataTable.dragColumn')}</span>
                </th>
              ) : null}
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
                  {reorder ? <td className={cn(cellBase, selectCell)} /> : null}
                  {selection ? <td className={cn(cellBase, selectCell)} /> : null}
                  {columns.map((col) => (
                    <td key={col.key} className={cn(cellBase, alignClass(col))}>
                      <Skeleton className={cn('br:w-3/4', col.numeric && 'br:ml-auto')} />
                    </td>
                  ))}
                  {rowActions ? <td className={cn(cellBase, stickyActions)} /> : null}
                </tr>
              ))
            : table.getRowModel().rows.map((row) => {
                const buildTr = (
                  state?: SortableState,
                  rowProps?: { ref(node: HTMLElement | null): void; style: CSSProperties },
                ) => (
                  <tr
                    key={row.id}
                    ref={rowProps?.ref}
                    style={rowProps?.style}
                    aria-selected={selection ? selection.selected.has(row.id) : undefined}
                    data-dragging={state?.dragging || undefined}
                    data-drop={state?.drop ?? undefined}
                    className={cn(ROW, state && DRAG_STATES)}
                  >
                    {reorder && state ? (
                      <td className={cn(cellBase, selectCell, rowHover, rowSelected, HANDLE_CELL)}>
                        <DragHandle
                          ref={state.setHandleRef}
                          label={t('dataTable.dragHandle', {
                            label: rowName(row.original, row.id, selection?.rowLabel, textKeys),
                          })}
                          disabled={!reorder.enabled}
                          disabledReason={reorder.disabledReason}
                          {...state.handleProps}
                        />
                      </td>
                    ) : null}
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
                          moreColumns,
                          'br:text-right',
                        )}
                        data-more-columns={moreAtEnd || undefined}
                      >
                        {rowActions(row.original)}
                      </td>
                    ) : null}
                  </tr>
                );
                const expansion = rowExpansion?.(row.original);
                const place = (tr: ReactElement) =>
                  rowWrapper ? rowWrapper(row.original, tr) : tr;
                return (
                  <Fragment key={row.id}>
                    {reorder ? (
                      <SortableRow id={row.id} disabled={!reorder.enabled}>
                        {(state, rowProps) => place(buildTr(state, rowProps))}
                      </SortableRow>
                    ) : (
                      place(buildTr())
                    )}
                    {expansion != null && expansion !== false ? (
                      <tr data-expansion="">
                        <td
                          colSpan={
                            columns.length +
                            (reorder ? 1 : 0) +
                            (selection ? 1 : 0) +
                            (rowActions ? 1 : 0)
                          }
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
    </div>,
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
