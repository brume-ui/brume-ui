import { ChevronRight, ChevronsRight } from 'lucide-react';
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';

export interface DualListboxOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface DualListboxProps extends FieldControlProps {
  /** Selected values in the order they were chosen. */
  value: string[];
  onChange(value: string[]): void;
  onBlur?(): void;
  options: DualListboxOption[];
  /** Accessible name of the group and part of each pane's name. */
  label: string;
  /** At this many selected values nothing more can be moved in. */
  max?: number;
  disabled?: boolean;
  readOnly?: boolean;
}

type PaneName = 'available' | 'selected';

interface PaneState {
  filter: string;
  picked: string[];
  active: string | null;
}
const EMPTY: PaneState = { filter: '', picked: [], active: null };

const BUTTON =
  'br:inline-flex br:size-9 br:items-center br:justify-center br:rounded-input br:border br:border-border-strong br:bg-surface br:text-text-muted br:transition-colors br:duration-fast br:enabled:hover:bg-surface-canvas br:enabled:hover:text-text br:disabled:cursor-not-allowed br:disabled:opacity-50';

/**
 * Two listboxes (「可選」／「已選」) with filters; options move between them by button, double
 * click or Enter. The value keeps the order of selection. Options in `value` that are not in
 * `options` are left alone. With `max`, moves into 「已選」 stop at the limit (a move that would
 * overshoot takes only what fits).
 */
export function DualListbox({
  value,
  onChange,
  onBlur,
  options,
  label,
  max,
  disabled,
  readOnly,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: DualListboxProps) {
  const { t } = useBrume();
  const autoId = useId();
  const baseId = id ?? autoId;
  const [state, setState] = useState<Record<PaneName, PaneState>>({
    available: EMPTY,
    selected: EMPTY,
  });
  const locked = Boolean(disabled || readOnly);
  const rootRef = useRef<HTMLDivElement>(null);
  const refocus = useRef<PaneName | null>(null);
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const items = useMemo(() => {
    const chosen = new Set(value);
    return {
      available: options.filter((o) => !chosen.has(o.value)),
      selected: value.flatMap((v) => {
        const o = byValue.get(v);
        return o ? [o] : [];
      }),
    } satisfies Record<PaneName, DualListboxOption[]>;
  }, [options, value, byValue]);

  const visible = (name: PaneName) => {
    const q = state[name].filter.trim().toLowerCase();
    return q ? items[name].filter((o) => o.label.toLowerCase().includes(q)) : items[name];
  };
  const patch = (name: PaneName, next: Partial<PaneState>) =>
    setState((s) => ({ ...s, [name]: { ...s[name], ...next } }));

  const room = max === undefined ? Number.POSITIVE_INFINITY : Math.max(0, max - value.length);
  const movable = (name: PaneName, values: string[]) => {
    const wanted = new Set(values);
    const list = visible(name).filter((o) => wanted.has(o.value) && !o.disabled);
    return name === 'available' ? list.slice(0, room) : list;
  };
  const move = (name: PaneName, values: string[]) => {
    if (locked) return;
    const batch = movable(name, values).map((o) => o.value);
    if (batch.length === 0) return;
    const gone = new Set(batch);
    onChange(name === 'available' ? [...value, ...batch] : value.filter((v) => !gone.has(v)));
    patch(name, { picked: state[name].picked.filter((v) => !gone.has(v)) });
  };

  // A button that disables itself after its move would drop focus: send it to the receiving pane.
  const moveByButton = (name: PaneName, values: string[]) => {
    refocus.current = name === 'available' ? 'selected' : 'available';
    move(name, values);
  };
  useEffect(() => {
    const target = refocus.current;
    if (target === null) return;
    refocus.current = null;
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && active.disabled) {
      rootRef.current?.querySelector<HTMLElement>(`[data-pane="${target}"]`)?.focus();
    }
  });

  const pickedIn = (name: PaneName) => {
    const here = new Set(items[name].map((o) => o.value));
    return state[name].picked.filter((v) => here.has(v));
  };
  const allOf = (name: PaneName) => visible(name).map((o) => o.value);

  const pane = (name: PaneName) => (
    <Pane
      name={name}
      baseId={baseId}
      title={t(name === 'available' ? 'dual.available' : 'dual.selected')}
      label={label}
      list={visible(name)}
      total={items[name].length}
      state={state[name]}
      grouped={name === 'available'}
      disabled={disabled}
      invalid={name === 'selected' && isInvalid}
      required={name === 'selected' && ariaOn(ariaRequired)}
      describedBy={describedBy}
      onPatch={(next) => patch(name, next)}
      onMove={(values) => move(name, values)}
    />
  );

  const addDisabled =
    locked || room === 0 || movable('available', pickedIn('available')).length === 0;
  const addAllDisabled =
    locked || room === 0 || movable('available', allOf('available')).length === 0;
  const removeDisabled = locked || movable('selected', pickedIn('selected')).length === 0;
  const removeAllDisabled = locked || movable('selected', allOf('selected')).length === 0;
  const arrow = 'br:rotate-90 br:@min-[640px]:rotate-0';

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would need a visible legend; the group is named by aria-label.
    <div
      id={id}
      ref={rootRef}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onBlur?.();
      }}
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className="br:@container br:min-w-0"
    >
      <div className="br:flex br:min-w-0 br:flex-col br:gap-3 br:@min-[640px]:flex-row br:@min-[640px]:items-stretch">
        {pane('available')}
        <div className="br:flex br:flex-row br:items-center br:justify-center br:gap-2 br:@min-[640px]:flex-col">
          <MoveButton
            label={t('dual.add')}
            disabled={addDisabled}
            onClick={() => moveByButton('available', pickedIn('available'))}
          >
            <ChevronRight aria-hidden="true" className={cn('br:size-4', arrow)} />
          </MoveButton>
          <MoveButton
            label={t('dual.addAll')}
            disabled={addAllDisabled}
            onClick={() => moveByButton('available', allOf('available'))}
          >
            <ChevronsRight aria-hidden="true" className={cn('br:size-4', arrow)} />
          </MoveButton>
          <MoveButton
            label={t('dual.remove')}
            disabled={removeDisabled}
            onClick={() => moveByButton('selected', pickedIn('selected'))}
          >
            <ChevronRight
              aria-hidden="true"
              className={cn('br:size-4 br:-rotate-90 br:@min-[640px]:rotate-180')}
            />
          </MoveButton>
          <MoveButton
            label={t('dual.removeAll')}
            disabled={removeAllDisabled}
            onClick={() => moveByButton('selected', allOf('selected'))}
          >
            <ChevronsRight
              aria-hidden="true"
              className={cn('br:size-4 br:-rotate-90 br:@min-[640px]:rotate-180')}
            />
          </MoveButton>
        </div>
        {pane('selected')}
      </div>
    </div>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(BUTTON, FOCUS_RING)}
    >
      {children}
    </button>
  );
}

interface PaneProps {
  name: PaneName;
  baseId: string;
  title: string;
  label: string;
  list: DualListboxOption[];
  total: number;
  state: PaneState;
  grouped: boolean;
  disabled?: boolean;
  invalid: boolean;
  required: boolean;
  describedBy?: string;
  onPatch(next: Partial<PaneState>): void;
  onMove(values: string[]): void;
}

function Pane({
  name,
  baseId,
  title,
  label,
  list,
  total,
  state,
  grouped,
  disabled,
  invalid,
  required,
  describedBy,
  onPatch,
  onMove,
}: PaneProps) {
  const { t } = useBrume();
  const anchor = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const positions = useMemo(() => new Map(list.map((o, k) => [o.value, k])), [list]);
  const optionId = (v: string) => `${baseId}-${name}-${positions.get(v) ?? -1}`;
  const activeValue =
    state.active !== null && positions.has(state.active) ? state.active : (list[0]?.value ?? null);
  const picked = new Set(state.picked);

  useEffect(() => {
    if (activeValue === null) return;
    root.current
      ?.querySelector<HTMLElement>(`[id="${optionId(activeValue)}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  });

  const range = (from: string, to: string) => {
    const a = positions.get(from) ?? -1;
    const b = positions.get(to) ?? -1;
    if (a < 0 || b < 0) return [to];
    return list
      .slice(Math.min(a, b), Math.max(a, b) + 1)
      .filter((o) => !o.disabled)
      .map((o) => o.value);
  };

  const go = (to: string, extend: boolean) => {
    if (extend) onPatch({ active: to, picked: range(anchor.current ?? to, to) });
    else onPatch({ active: to });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || list.length === 0) return;
    const at = Math.max(
      0,
      list.findIndex((o) => o.value === activeValue),
    );
    const current = list[at] as DualListboxOption;
    const step = (to: number) => {
      e.preventDefault();
      const target = list[Math.min(list.length - 1, Math.max(0, to))] as DualListboxOption;
      if (e.shiftKey && anchor.current === null) anchor.current = current.value;
      go(target.value, e.shiftKey);
      if (!e.shiftKey) anchor.current = null;
    };
    if (e.key === 'ArrowDown') step(at + 1);
    else if (e.key === 'ArrowUp') step(at - 1);
    else if (e.key === 'Home') step(0);
    else if (e.key === 'End') step(list.length - 1);
    else if (e.key === ' ') {
      e.preventDefault();
      if (current.disabled) return;
      anchor.current = current.value;
      onPatch({
        active: current.value,
        picked: picked.has(current.value)
          ? state.picked.filter((v) => v !== current.value)
          : [...state.picked, current.value],
      });
    } else if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onPatch({ picked: list.filter((o) => !o.disabled).map((o) => o.value) });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (current.disabled) return;
      const neighbour = list[at + 1] ?? list[at - 1];
      onMove([current.value]);
      onPatch({ active: neighbour?.value ?? null });
    }
  };

  const onOptionClick = (e: MouseEvent, o: DualListboxOption) => {
    if (disabled || o.disabled) return;
    if (e.shiftKey && anchor.current !== null) {
      onPatch({ active: o.value, picked: range(anchor.current, o.value) });
    } else if (e.ctrlKey || e.metaKey) {
      anchor.current = o.value;
      onPatch({
        active: o.value,
        picked: picked.has(o.value)
          ? state.picked.filter((v) => v !== o.value)
          : [...state.picked, o.value],
      });
    } else {
      anchor.current = o.value;
      onPatch({ active: o.value, picked: [o.value] });
    }
  };

  const renderOption = (o: DualListboxOption) => {
    const on = picked.has(o.value);
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled on the listbox (activedescendant pattern).
      // biome-ignore lint/a11y/useFocusableInteractive: options are never focused; the listbox keeps focus (activedescendant).
      <div
        key={o.value}
        id={optionId(o.value)}
        role="option"
        aria-selected={on}
        aria-disabled={o.disabled || undefined}
        onClick={(e) => onOptionClick(e, o)}
        onDoubleClick={() => {
          if (!disabled && !o.disabled) onMove([o.value]);
        }}
        className={cn(
          'br:flex br:min-w-0 br:cursor-default br:select-none br:items-center br:gap-2 br:rounded-[6px] br:px-2 br:py-1.5 br:text-sm',
          on ? 'br:bg-accent-tint br:text-accent-tint-text' : 'br:text-text',
          o.disabled && 'br:opacity-50',
          o.value === activeValue && 'br:ring-2 br:ring-inset br:ring-focus-ring',
        )}
      >
        <span className="br:min-w-0 br:truncate">{o.label}</span>
        {!grouped && o.group ? (
          <span className="br:shrink-0 br:text-xs br:text-text-muted">{o.group}</span>
        ) : null}
      </div>
    );
  };

  const body = () => {
    if (list.length === 0) {
      return (
        // A listbox must own options (axe aria-required-children): the empty note is a disabled one.
        // biome-ignore lint/a11y/useFocusableInteractive: like every option here it is never focused (the listbox keeps focus).
        <div
          role="option"
          aria-selected={false}
          aria-disabled="true"
          className="br:px-2 br:py-1.5 br:text-sm br:text-text-muted"
        >
          {t('dual.empty')}
        </div>
      );
    }
    if (!grouped || !list.some((o) => o.group)) return list.map(renderOption);
    const groups: { group: string; items: DualListboxOption[] }[] = [];
    for (const o of list) {
      const g = o.group ?? '';
      const last = groups[groups.length - 1];
      if (last && last.group === g) last.items.push(o);
      else groups.push({ group: g, items: [o] });
    }
    return groups.map((g, i) =>
      g.group === '' ? (
        g.items.map(renderOption)
      ) : (
        // biome-ignore lint/a11y/useSemanticElements: an option group inside a listbox is role=group.
        <div key={g.items[0]?.value} role="group" aria-labelledby={`${baseId}-${name}-g${i}`}>
          <div
            id={`${baseId}-${name}-g${i}`}
            className="br:px-2 br:pb-0.5 br:pt-2 br:text-xs br:font-medium br:text-text-muted"
          >
            {g.group}
          </div>
          {g.items.map(renderOption)}
        </div>
      ),
    );
  };

  return (
    <div className="br:flex br:min-w-0 br:flex-1 br:flex-col br:gap-1.5">
      <div className="br:flex br:items-baseline br:justify-between br:text-sm br:font-medium br:text-text">
        <span id={`${baseId}-${name}-title`}>{title}</span>
        <span className="br:text-xs br:font-normal br:text-text-muted">
          {t('dual.count', { shown: list.length, total })}
        </span>
      </div>
      <input
        type="text"
        aria-label={t('dual.filter', { pane: `${label} ${title}` })}
        autoComplete="off"
        disabled={disabled}
        value={state.filter}
        onChange={(e) => onPatch({ filter: e.target.value })}
        className={cn(CONTROL_BASE, CONTROL_BORDER, FOCUS_RING, 'br:w-full br:min-w-0')}
      />
      <div
        ref={root}
        role="listbox"
        data-pane={name}
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label} ${title}`}
        aria-multiselectable="true"
        aria-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        aria-activedescendant={activeValue !== null ? optionId(activeValue) : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          'br:h-56 br:overflow-y-auto br:rounded-input br:border br:bg-surface br:p-1',
          invalid ? 'br:border-danger' : 'br:border-border-strong',
          disabled && 'br:opacity-50',
          FOCUS_RING,
        )}
      >
        {body()}
      </div>
    </div>
  );
}
