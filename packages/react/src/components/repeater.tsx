import type { RowIdentity } from '@brume-ui/brume-schema';
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';
import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { useBrume } from '../provider';
import { Button } from './button';
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
      <ol ref={root} aria-label={label} className="br:grid br:gap-4 br:list-none br:m-0 br:p-0">
        {rows.map((row, index) => {
          const name = `${label} ${index + 1}`;
          return (
            <li
              key={row.key}
              data-repeater-key={row.key}
              tabIndex={-1}
              className={`br:min-w-0 br:grid br:gap-3 br:rounded-control br:bg-surface-canvas br:p-4 ${FOCUS_RING}`}
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
              <div className="br:flex br:flex-wrap br:items-center br:justify-between br:gap-2">
                <span>{name}</span>
                <div className="br:flex br:items-center br:gap-1">
                  {sortable ? (
                    <>
                      <IconButton
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
                        label={t('repeater.up', { name })}
                        icon={ArrowUp}
                        disabled={disabled || index === 0}
                        onClick={() => move(index, index - 1)}
                      />
                      <IconButton
                        label={t('repeater.down', { name })}
                        icon={ArrowDown}
                        disabled={disabled || index === rows.length - 1}
                        onClick={() => move(index, index + 1)}
                      />
                    </>
                  ) : null}
                  <IconButton
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
              {renderRow(row, index)}
            </li>
          );
        })}
      </ol>
      <div>
        <Button
          ref={add}
          variant="secondary"
          disabled={disabled || (max !== undefined && rows.length >= max)}
          onClick={onAdd}
        >
          {t('repeater.add', { label })}
        </Button>
      </div>
    </div>
  );
}
