import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
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
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  getRowId(row: T): string;
  loading?: boolean;
  empty: Pick<EmptyStateProps, 'title' | 'description' | 'action'>;
  caption?: string;
}

const SKELETON_ROWS = 5;
/** Floor for columns without a fixed width, so narrow screens scroll instead of squeezing. */
const MIN_FLUID_COLUMN = '8rem';

function minTableWidth(columns: Array<{ width?: string }>): string {
  const parts = columns.map((c) =>
    c.width && !c.width.endsWith('%') ? c.width : MIN_FLUID_COLUMN,
  );
  return `calc(${parts.join(' + ')})`;
}

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
  columns,
  rows,
  getRowId,
  loading = false,
  empty,
  caption,
}: DataTableProps<T>) {
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
        className="br:w-full br:table-fixed br:border-separate br:border-spacing-y-1"
        style={{ minWidth: minTableWidth(columns) }}
      >
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} style={col.width ? { width: col.width } : undefined} />
          ))}
        </colgroup>
        {caption ? <caption className="br:sr-only">{caption}</caption> : null}
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={cn(
                    'br:truncate br:px-4 br:pb-1 br:text-xs br:font-semibold br:text-text-muted',
                    alignClass(meta.get(header.column.id) ?? {}),
                  )}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className={cn(cellBase, alignClass(col))}>
                      <Skeleton className={cn('br:w-3/4', col.numeric && 'br:ml-auto')} />
                    </td>
                  ))}
                </tr>
              ))
            : table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const col = meta.get(cell.column.id);
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          cellBase,
                          col && alignClass(col),
                          col?.numeric && 'br:tabular-nums',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
        </tbody>
      </table>
      {showEmpty ? <EmptyState {...empty} /> : null}
    </div>
  );
}
