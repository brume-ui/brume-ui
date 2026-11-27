import { Plus, X } from 'lucide-react';
import { type KeyboardEvent, useId, useLayoutEffect, useRef } from 'react';
import { cn } from '../cn';
import { PRESS } from '../motion/classes';
import { useBrume } from '../provider';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';
import { IconButton } from './icon-button';
import { useRowKeys } from './use-row-keys';

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface KeyValueInputProps extends FieldControlProps {
  value: KeyValuePair[];
  onChange(value: KeyValuePair[]): void;
  onBlur?(): void;
  /** Accessible name of the group and base of each row's button names. */
  label: string;
  /** Column headers; default 「鍵」／「值」. */
  keyLabel?: string;
  valueLabel?: string;
  /** At this many rows the add button is disabled. */
  max?: number;
  /** Error messages by row position; shown under the cell and tied to its input. */
  errors?: Record<number, { key?: string; value?: string }>;
  disabled?: boolean;
  readOnly?: boolean;
}

type Cell = 'key' | 'value';

/**
 * Ordered key/value pairs in two columns. Rows are not trimmed, deduplicated or dropped here:
 * validation belongs to the renderer and the server. Enter in the last row's value adds a row.
 */
export function KeyValueInput({
  value,
  onChange,
  onBlur,
  label,
  keyLabel,
  valueLabel,
  max,
  errors,
  disabled,
  readOnly,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: KeyValueInputProps) {
  const { t } = useBrume();
  const autoId = useId();
  const baseId = id ?? autoId;
  const rows = useRowKeys(value.length);
  const root = useRef<HTMLDivElement>(null);
  const add = useRef<HTMLButtonElement>(null);
  const focus = useRef<{ key: string; cell: Cell } | 'add' | null>(null);
  const keyHeader = keyLabel ?? t('keyValue.key');
  const valueHeader = valueLabel ?? t('keyValue.value');
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  const locked = Boolean(disabled || readOnly);
  const atMax = max !== undefined && value.length >= max;

  useLayoutEffect(() => {
    const target = focus.current;
    if (target === null) return;
    focus.current = null;
    if (target === 'add') {
      add.current?.focus();
      return;
    }
    root.current
      ?.querySelector<HTMLElement>(`[data-row="${target.key}"] [data-cell="${target.cell}"]`)
      ?.focus();
  });

  const append = () => {
    if (locked || atMax) return;
    rows.insert(value.length);
    focus.current = { key: rows.keys[value.length] ?? '', cell: 'key' };
    onChange([...value, { key: '', value: '' }]);
  };
  const remove = (index: number) => {
    if (locked) return;
    const neighbour = rows.keys[index + 1] ?? rows.keys[index - 1];
    focus.current = neighbour ? { key: neighbour, cell: 'key' } : 'add';
    rows.remove(index);
    onChange(value.filter((_, i) => i !== index));
  };
  const edit = (index: number, cell: Cell, text: string) =>
    onChange(value.map((pair, i) => (i === index ? { ...pair, [cell]: text } : pair)));

  const onValueKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    // keyCode 229: Safari sends the IME's committing Enter after compositionend.
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
      if (e.key === 'Enter') e.preventDefault();
      return;
    }
    if (e.key !== 'Enter' || index !== value.length - 1 || atMax || locked) return;
    e.preventDefault();
    append();
  };

  const cellInput = (index: number, cell: Cell, rowKey: string) => {
    const error = errors?.[index]?.[cell];
    const errorId = `${baseId}-${rowKey}-${cell}-error`;
    const header = cell === 'key' ? keyHeader : valueHeader;
    const describe = [describedBy, error ? errorId : undefined].filter(Boolean).join(' ');
    return (
      <div className="br:flex br:min-w-0 br:flex-col br:gap-1">
        <input
          type="text"
          data-cell={cell}
          aria-label={`${header} ${index + 1}`}
          aria-describedby={describe || undefined}
          aria-invalid={isInvalid || Boolean(error) || undefined}
          aria-required={(cell === 'key' && ariaOn(ariaRequired)) || undefined}
          autoComplete="off"
          disabled={disabled}
          readOnly={readOnly}
          value={value[index]?.[cell] ?? ''}
          onChange={(e) => edit(index, cell, e.target.value)}
          onKeyDown={cell === 'value' ? (e) => onValueKeyDown(e, index) : undefined}
          onBlur={onBlur}
          className={cn(
            CONTROL_BASE,
            isInvalid || error ? 'br:border-danger' : CONTROL_BORDER,
            readOnly && 'br:bg-surface-canvas',
            FOCUS_RING,
            'br:w-full br:min-w-0',
          )}
        />
        {error ? (
          <p id={errorId} className="br:m-0 br:text-sm br:text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  const GRID = 'br:grid br:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1.75rem] br:items-start br:gap-2';
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would need a visible legend; the group is named by aria-label.
    <div
      id={id}
      ref={root}
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="br:grid br:min-w-0 br:gap-2"
    >
      {value.length > 0 ? (
        <div
          aria-hidden="true"
          className={cn(GRID, 'br:text-[13px] br:font-medium br:text-text-muted')}
        >
          <span>{keyHeader}</span>
          <span>{valueHeader}</span>
          <span />
        </div>
      ) : null}
      {value.map((_, index) => {
        const rowKey = rows.keys[index] ?? String(index);
        return (
          <div key={rowKey} data-row={rowKey} className={GRID}>
            {cellInput(index, 'key', rowKey)}
            {cellInput(index, 'value', rowKey)}
            {readOnly ? (
              <span />
            ) : (
              <IconButton
                size="sm"
                icon={X}
                label={t('repeater.remove', { name: `${label} ${index + 1}` })}
                disabled={disabled}
                onClick={() => remove(index)}
                className="br:mt-1"
              />
            )}
          </div>
        );
      })}
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
