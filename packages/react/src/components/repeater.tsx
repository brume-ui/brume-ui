import type { RowIdentity } from '@brume-ui/brume-schema';
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from 'lucide-react';
import { createContext, type ReactNode, useContext, useLayoutEffect, useRef } from 'react';
import { cn } from '../cn';
import { PRESS } from '../motion/classes';
import { useBrume } from '../provider';
import { FOCUS_RING } from './focus';
import { IconButton } from './icon-button';

export interface RepeaterProps {
  label: string;
  rows: readonly RowIdentity[];
  onAdd(): void;
  onRemove(index: number): void;
  onMove(from: number, to: number): void;
  renderRow(row: RowIdentity, index: number): ReactNode;
  min?: number;
  max?: number;
  disabled?: boolean;
  sortable?: boolean;
}
/** How deep this repeater sits inside other repeaters: the outer list is framed, inner ones hang off a rail. */
const RepeaterDepth = createContext(0);

/**
 * Row actions stay out of the way until the row is hovered or holds focus; touch screens (no hover)
 * always show them.
 */
const ROW_ACTIONS =
  'br:flex br:items-center br:gap-0.5 br:transition-opacity br:duration-fast br:ease-out br:[@media(hover:hover)]:opacity-0 br:[@media(hover:hover)]:group-hover/row:opacity-100 br:[@media(hover:hover)]:group-focus-within/row:opacity-100';

/** Controlled row presentation. Stable keys belong to the caller; no values or transport live here. */
export function Repeater({
  label,
  rows,
  onAdd,
  onRemove,
  onMove,
  min = 0,
  max,
  disabled,
  sortable = true,
  renderRow,
}: RepeaterProps) {
  const { t } = useBrume();
  const depth = useContext(RepeaterDepth);
  const root = useRef<HTMLOListElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const focus = useRef<string | 'add' | null>(null);
  const dragged = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (focus.current === null) return;
    const target = Array.from(root.current?.children ?? []).find(
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
  return (
    <div className="br:grid br:gap-3">
      <ol
        ref={root}
        aria-label={label}
        className={cn(
          'br:grid br:list-none br:m-0 br:p-0 br:divide-y br:divide-border',
          rows.length === 0 && 'br:hidden',
          depth === 0
            ? 'br:rounded-card br:border br:border-border'
            : 'br:border-l-2 br:border-border br:pl-4',
        )}
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
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === 'ArrowUp' || event.key === 'ArrowDown')
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  move(index, index + (event.key === 'ArrowUp' ? -1 : 1));
                }
              }}
              onDragOver={(event) => {
                if (!disabled && sortable && dragged.current) event.preventDefault();
              }}
              onDrop={(event) => {
                // An outer drag may land on this nested row; let its owning list handle it.
                if (dragged.current === null) return;
                event.preventDefault();
                // A nested repeater drop must never reorder an outer row.
                event.stopPropagation();
                const from = rows.findIndex((item) => item.key === dragged.current);
                dragged.current = null;
                move(from, index);
              }}
            >
              <div className="br:flex br:min-h-7 br:flex-wrap br:items-center br:justify-between br:gap-2">
                {/* The visible label is a short ordinal; buttons still name the full 「標籤 N」. */}
                <span className="br:text-[13px] br:font-medium br:text-text-muted br:tabular-nums">
                  <span aria-hidden="true">#{index + 1}</span>
                  <span className="br:sr-only">{name}</span>
                </span>
                <div className={ROW_ACTIONS}>
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
                </div>
              </div>
              <RepeaterDepth.Provider value={depth + 1}>
                {renderRow(row, index)}
              </RepeaterDepth.Provider>
            </li>
          );
        })}
      </ol>
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
