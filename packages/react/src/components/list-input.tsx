import { ArrowDown, ArrowUp, GripVertical, Plus, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';
import { cn } from '../cn';
import { PRESS } from '../motion/classes';
import { useBrume } from '../provider';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';
import { IconButton } from './icon-button';
import { useRowKeys } from './use-row-keys';

export interface ListInputProps extends FieldControlProps {
  value: string[];
  onChange(value: string[]): void;
  onBlur?(): void;
  /** Accessible name of the list and base of each row's names. */
  label: string;
  min?: number;
  max?: number;
  /** Native per-item `maxlength` (typing and paste stop there). */
  maxLength?: number;
  /** Up/down buttons and drag handles; default true. */
  sortable?: boolean;
  /** Error messages by row position; tied to that row's input. */
  errors?: Record<number, string>;
  disabled?: boolean;
  readOnly?: boolean;
}

type Act = 'grip' | 'up' | 'down';

/**
 * One text input per row. Blank rows are kept while typing (trimming and dropping are the
 * renderer's and the server's job); add is disabled at `max`, remove at `min`.
 */
export function ListInput({
  value,
  onChange,
  onBlur,
  label,
  min = 0,
  max,
  maxLength,
  sortable = true,
  errors,
  disabled,
  readOnly,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: ListInputProps) {
  const { t } = useBrume();
  const autoId = useId();
  const baseId = id ?? autoId;
  const rows = useRowKeys(value.length);
  const root = useRef<HTMLUListElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const focus = useRef<{ key: string; act: Act | 'input' } | 'add' | null>(null);
  const dragged = useRef<string | null>(null);
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  const locked = Boolean(disabled || readOnly);
  const atMax = max !== undefined && value.length >= max;
  const canSort = sortable && !readOnly;

  useLayoutEffect(() => {
    const target = focus.current;
    if (target === null) return;
    focus.current = null;
    if (target === 'add') {
      add.current?.focus();
      return;
    }
    const li = root.current?.querySelector<HTMLElement>(`[data-row="${target.key}"]`);
    const pick = (sel: string) => li?.querySelector<HTMLElement>(sel);
    const wanted = target.act === 'input' ? 'input' : `[data-act="${target.act}"]`;
    const el = pick(wanted);
    // A button disabled at the edge cannot take focus: fall back to the grip, then the input.
    if (el && !(el as HTMLButtonElement).disabled) el.focus();
    else (pick('[data-act="grip"]') ?? pick('input'))?.focus();
  });

  const append = () => {
    if (locked || atMax) return;
    rows.insert(value.length);
    focus.current = { key: rows.keys[value.length] ?? '', act: 'input' };
    onChange([...value, '']);
  };
  const remove = (index: number) => {
    if (locked || value.length <= min) return;
    const neighbour = rows.keys[index + 1] ?? rows.keys[index - 1];
    focus.current = neighbour ? { key: neighbour, act: 'input' } : 'add';
    rows.remove(index);
    onChange(value.filter((_, i) => i !== index));
  };
  const move = (from: number, to: number, act: Act) => {
    if (locked || !canSort || from < 0 || from === to || to < 0 || to >= value.length) return;
    focus.current = { key: rows.keys[from] ?? '', act };
    rows.move(from, to);
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item ?? '');
    onChange(next);
  };

  return (
    <div id={id} className="br:grid br:min-w-0 br:gap-2">
      <ul
        ref={root}
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn(
          'br:m-0 br:grid br:list-none br:gap-2 br:p-0',
          value.length === 0 && 'br:hidden',
        )}
      >
        {value.map((item, index) => {
          const rowKey = rows.keys[index] ?? String(index);
          const name = `${label} ${index + 1}`;
          const error = errors?.[index];
          const errorId = `${baseId}-${rowKey}-error`;
          const describe = [describedBy, error ? errorId : undefined].filter(Boolean).join(' ');
          return (
            <li
              key={rowKey}
              data-row={rowKey}
              className="br:grid br:min-w-0 br:gap-1"
              onDragOver={(e) => {
                if (!locked && canSort && dragged.current) e.preventDefault();
              }}
              onDrop={(e) => {
                if (dragged.current === null) return;
                e.preventDefault();
                e.stopPropagation();
                const from = rows.keys.indexOf(dragged.current);
                dragged.current = null;
                move(from, index, 'grip');
              }}
            >
              <div className="br:flex br:items-center br:gap-1">
                <input
                  type="text"
                  aria-label={name}
                  aria-describedby={describe || undefined}
                  aria-invalid={isInvalid || Boolean(error) || undefined}
                  aria-required={ariaOn(ariaRequired) || undefined}
                  autoComplete="off"
                  maxLength={maxLength}
                  disabled={disabled}
                  readOnly={readOnly}
                  value={item}
                  onChange={(e) =>
                    onChange(value.map((v, i) => (i === index ? e.target.value : v)))
                  }
                  onBlur={onBlur}
                  className={cn(
                    CONTROL_BASE,
                    isInvalid || error ? 'br:border-danger' : CONTROL_BORDER,
                    readOnly && 'br:bg-surface-canvas',
                    FOCUS_RING,
                    'br:min-w-0 br:flex-1',
                  )}
                />
                {canSort ? (
                  <>
                    <IconButton
                      size="sm"
                      data-act="grip"
                      label={t('repeater.sort', { name })}
                      icon={GripVertical}
                      disabled={disabled}
                      draggable={!disabled}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        dragged.current = rowKey;
                        e.dataTransfer.setData('text/plain', rowKey);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        dragged.current = null;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          e.stopPropagation();
                          move(index, index + (e.key === 'ArrowUp' ? -1 : 1), 'grip');
                        }
                      }}
                    />
                    <IconButton
                      size="sm"
                      data-act="up"
                      label={t('repeater.up', { name })}
                      icon={ArrowUp}
                      disabled={disabled || index === 0}
                      onClick={() => move(index, index - 1, 'up')}
                    />
                    <IconButton
                      size="sm"
                      data-act="down"
                      label={t('repeater.down', { name })}
                      icon={ArrowDown}
                      disabled={disabled || index === value.length - 1}
                      onClick={() => move(index, index + 1, 'down')}
                    />
                  </>
                ) : null}
                {readOnly ? null : (
                  <IconButton
                    size="sm"
                    label={t('repeater.remove', { name })}
                    icon={X}
                    disabled={disabled || value.length <= min}
                    onClick={() => remove(index)}
                  />
                )}
              </div>
              {error ? (
                <p id={errorId} className="br:m-0 br:text-sm br:text-danger">
                  {error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {readOnly ? null : (
        <button
          ref={add}
          type="button"
          disabled={disabled || atMax}
          onClick={append}
          className={cn(
            'br:flex br:h-9 br:w-full br:items-center br:justify-center br:gap-1.5 br:rounded-input br:border br:border-dashed br:border-[color-mix(in_oklab,var(--br-border-strong)_60%,var(--br-surface))] br:text-sm br:font-medium br:text-text-muted br:transition-colors br:duration-fast br:ease-out br:enabled:hover:border-accent br:enabled:hover:bg-accent-tint br:enabled:hover:text-accent-tint-text br:disabled:cursor-not-allowed br:disabled:opacity-50',
            PRESS,
            FOCUS_RING,
          )}
        >
          <Plus aria-hidden="true" className="br:size-4" />
          {t('repeater.add', { label })}
        </button>
      )}
    </div>
  );
}
