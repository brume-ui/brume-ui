import type { RowIdentity } from '@brume-ui/brume-schema';
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from 'lucide-react';
import {
  createContext,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef,
} from 'react';
import { cn } from '../cn';
import { PRESS } from '../motion/classes';
import { useBrume } from '../provider';
import { FOCUS_RING } from './focus';
import { IconButton } from './icon-button';

interface RepeaterBaseProps {
  label: string;
  rows: readonly RowIdentity[];
  onAdd(): void;
  onRemove(index: number): void;
  onMove(from: number, to: number): void;
  min?: number;
  max?: number;
  disabled?: boolean;
  sortable?: boolean;
}
export interface RepeaterColumn {
  key: string;
  label: string;
  required?: boolean;
}
/** Each row is one free-form block rendered by `renderRow`. */
export interface RepeaterProps extends RepeaterBaseProps {
  layout?: 'stack';
  renderRow(row: RowIdentity, index: number): ReactNode;
  columns?: never;
  renderCell?: never;
}
/** A real table: the Repeater renders one cell per column via `renderCell`; `renderRow` is not used. */
export interface RepeaterTableProps extends RepeaterBaseProps {
  layout: 'table';
  columns: readonly RepeaterColumn[];
  /** Return `null`, `undefined` or a boolean for a cell with nothing in it: its td stays (alignment) but draws no caption. */
  renderCell(row: RowIdentity, index: number, columnKey: string): ReactNode;
  renderRow?: never;
}
/** Everything `<Repeater>` accepts: the original stack props or the table variant. */
export type RepeaterAnyProps = RepeaterProps | RepeaterTableProps;
/** How deep this repeater sits inside other repeaters: the outer list is framed, inner ones hang off a rail. */
const RepeaterDepth = createContext(0);

/**
 * Row actions stay out of the way until the row is hovered or holds focus; touch screens (no hover)
 * always show them.
 */
const ROW_ACTIONS =
  'br:flex br:items-center br:gap-0.5 br:transition-opacity br:duration-fast br:ease-out br:[@media(hover:hover)]:opacity-0 br:[@media(hover:hover)]:group-hover/row:opacity-100 br:[@media(hover:hover)]:group-focus-within/row:opacity-100';

/**
 * Spreading (not a literal attribute) because the roles are redundant on paper: below 640 px the
 * table elements become display:block, which makes some browsers (Safari/VoiceOver) drop the table
 * semantics, so they are stated explicitly.
 */
const explicit = (role: string) => ({ role });

/** Controlled row presentation. Stable keys belong to the caller; no values or transport live here. */
export function Repeater(props: RepeaterAnyProps) {
  const { label, rows, onAdd, onRemove, onMove, min = 0, max, disabled, sortable = true } = props;
  const { t } = useBrume();
  const depth = useContext(RepeaterDepth);
  const root = useRef<HTMLElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const focus = useRef<string | 'add' | null>(null);
  const dragged = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (focus.current === null) return;
    const container =
      root.current instanceof HTMLTableElement ? root.current.tBodies[0] : root.current;
    const target = Array.from(container?.children ?? []).find(
      (el) => (el as HTMLElement).dataset.repeaterKey === focus.current,
    ) as HTMLElement | undefined;
    (target ?? add.current)?.focus();
    focus.current = null;
  });
  const move = (from: number, to: number) => {
    if (disabled || !sortable || from === to || from < 0 || to < 0 || to >= rows.length) return;
    focus.current = rows[from]?.key ?? null;
    onMove(from, to);
  };
  const controls = (row: RowIdentity, index: number, name: string) => (
    <>
      {sortable ? (
        <>
          <IconButton
            size="sm"
            label={t('repeater.sort', { name })}
            icon={GripVertical}
            disabled={disabled}
            draggable={!disabled}
            onDragStart={(event) => {
              event.stopPropagation();
              dragged.current = row.key;
              event.dataTransfer.setData('text/plain', row.key);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              dragged.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                move(index, index + (event.key === 'ArrowUp' ? -1 : 1));
              }
            }}
          />
          <IconButton
            size="sm"
            label={t('repeater.up', { name })}
            icon={ArrowUp}
            disabled={disabled || index === 0}
            onClick={() => move(index, index - 1)}
          />
          <IconButton
            size="sm"
            label={t('repeater.down', { name })}
            icon={ArrowDown}
            disabled={disabled || index === rows.length - 1}
            onClick={() => move(index, index + 1)}
          />
        </>
      ) : null}
      <IconButton
        size="sm"
        label={t('repeater.remove', { name })}
        icon={X}
        disabled={disabled || rows.length <= min}
        onClick={() => {
          if (disabled || rows.length <= min) return;
          focus.current = rows[index + 1]?.key ?? rows[index - 1]?.key ?? 'add';
          onRemove(index);
        }}
      />
    </>
  );
  /** Row-level keyboard and native drag-and-drop handlers, shared by both layouts. */
  const rowHandlers = (index: number) => ({
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (
        event.target === event.currentTarget &&
        (event.key === 'ArrowUp' || event.key === 'ArrowDown')
      ) {
        event.preventDefault();
        event.stopPropagation();
        move(index, index + (event.key === 'ArrowUp' ? -1 : 1));
      }
    },
    onDragOver(event: DragEvent<HTMLElement>) {
      if (!disabled && sortable && dragged.current) event.preventDefault();
    },
    onDrop(event: DragEvent<HTMLElement>) {
      // An outer drag may land on this nested row; let its owning list handle it.
      if (dragged.current === null) return;
      event.preventDefault();
      // A nested repeater drop must never reorder an outer row.
      event.stopPropagation();
      const from = rows.findIndex((item) => item.key === dragged.current);
      dragged.current = null;
      move(from, index);
    },
  });
  const frame = cn(
    rows.length === 0 && 'br:hidden',
    depth === 0
      ? 'br:rounded-card br:border br:border-border'
      : 'br:border-l-2 br:border-border br:pl-4',
  );
  const list =
    props.layout === 'table' ? (
      <div className={cn('br:@container br:min-w-0', frame)}>
        <table
          ref={root as RefObject<HTMLTableElement>}
          {...explicit('table')}
          aria-label={label}
          className="br:m-0 br:w-full br:table-fixed br:border-collapse br:@max-[640px]:block"
        >
          <thead {...explicit('rowgroup')} className="br:@max-[640px]:sr-only">
            <tr {...explicit('row')} className="br:@max-[640px]:block">
              {props.columns.map((column) => (
                <th
                  key={column.key}
                  {...explicit('columnheader')}
                  scope="col"
                  className="br:min-w-0 br:px-3 br:py-2 br:text-left br:text-[13px] br:font-medium br:text-text-label br:@max-[640px]:block"
                >
                  {column.label}
                  {column.required ? (
                    <span aria-hidden="true" className="br:text-danger">
                      {' *'}
                    </span>
                  ) : null}
                </th>
              ))}
              <th
                {...explicit('columnheader')}
                scope="col"
                className={cn(
                  'br:px-3 br:py-2 br:@max-[640px]:block',
                  sortable ? 'br:w-32' : 'br:w-14',
                )}
              >
                <span className="br:sr-only">{t('repeater.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody {...explicit('rowgroup')} className="br:@max-[640px]:block">
            {rows.map((row, index) => {
              const name = `${label} ${index + 1}`;
              return (
                <tr
                  key={row.key}
                  {...explicit('row')}
                  data-repeater-key={row.key}
                  tabIndex={-1}
                  className={cn(
                    'br:group/row br:border-t br:border-border br:align-top br:@max-[640px]:grid br:@max-[640px]:gap-3 br:@max-[640px]:p-4',
                    FOCUS_RING,
                  )}
                  {...rowHandlers(index)}
                >
                  <RepeaterDepth.Provider value={depth + 1}>
                    {props.columns.map((column) => {
                      const cell = props.renderCell(row, index, column.key);
                      return (
                        <td
                          key={column.key}
                          {...explicit('cell')}
                          className="br:min-w-0 br:px-3 br:py-3 br:@max-[640px]:block br:@max-[640px]:p-0"
                        >
                          {/* Visual aid only: the cell's own field already labels its input. */}
                          {/* A cell with nothing in it (null) keeps its td for alignment but no caption. */}
                          {cell === null ||
                          cell === undefined ||
                          typeof cell === 'boolean' ? null : (
                            <span
                              aria-hidden="true"
                              data-repeater-cell-label=""
                              className="br:mb-1 br:hidden br:text-[13px] br:font-medium br:text-text-label br:@max-[640px]:block"
                            >
                              {column.label}
                            </span>
                          )}
                          {cell}
                        </td>
                      );
                    })}
                  </RepeaterDepth.Provider>
                  <td
                    {...explicit('cell')}
                    className="br:px-3 br:py-3 br:@max-[640px]:block br:@max-[640px]:p-0"
                  >
                    <div className={cn(ROW_ACTIONS, 'br:@max-[640px]:justify-end')}>
                      {controls(row, index, name)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <ol
        ref={root as RefObject<HTMLOListElement>}
        aria-label={label}
        className={cn('br:grid br:list-none br:m-0 br:p-0 br:divide-y br:divide-border', frame)}
      >
        {rows.map((row, index) => {
          const name = `${label} ${index + 1}`;
          return (
            <li
              key={row.key}
              data-repeater-key={row.key}
              tabIndex={-1}
              className={cn(
                'br:group/row br:min-w-0 br:grid br:gap-3 br:first:rounded-t-card br:last:rounded-b-card',
                depth === 0 ? 'br:p-4' : 'br:py-3',
                FOCUS_RING,
              )}
              {...rowHandlers(index)}
            >
              <div className="br:flex br:min-h-7 br:flex-wrap br:items-center br:justify-between br:gap-2">
                {/* The visible label is a short ordinal; buttons still name the full 「標籤 N」. */}
                <span className="br:text-[13px] br:font-medium br:text-text-muted br:tabular-nums">
                  <span aria-hidden="true">#{index + 1}</span>
                  <span className="br:sr-only">{name}</span>
                </span>
                <div className={ROW_ACTIONS}>{controls(row, index, name)}</div>
              </div>
              <RepeaterDepth.Provider value={depth + 1}>
                {props.renderRow(row, index)}
              </RepeaterDepth.Provider>
            </li>
          );
        })}
      </ol>
    );
  return (
    <div className="br:grid br:gap-3">
      {list}
      <button
        ref={add}
        type="button"
        disabled={disabled || (max !== undefined && rows.length >= max)}
        onClick={onAdd}
        className={cn(
          'br:flex br:h-9 br:w-full br:items-center br:justify-center br:gap-1.5 br:rounded-input br:border br:border-dashed br:border-[color-mix(in_oklab,var(--br-border-strong)_60%,var(--br-surface))] br:text-sm br:font-medium br:text-text-muted br:transition-colors br:duration-fast br:ease-out br:enabled:hover:border-accent br:enabled:hover:bg-accent-tint br:enabled:hover:text-accent-tint-text br:disabled:cursor-not-allowed br:disabled:opacity-50',
          PRESS,
          FOCUS_RING,
        )}
      >
        <Plus aria-hidden="true" className="br:size-4" />
        {t('repeater.add', { label })}
      </button>
    </div>
  );
}
