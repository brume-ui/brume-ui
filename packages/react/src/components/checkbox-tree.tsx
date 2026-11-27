import { Check, ChevronRight, Minus } from 'lucide-react';
import { type KeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import {
  canonicalTreeValue,
  type TreeMode,
  type TreeOption,
  toggleTreeAll,
  toggleTreeNode,
  treeAllSelected,
  treeCheckStates,
  treeShape,
} from './checkbox-tree-model';
import { ariaOn, type FieldControlProps } from './field';
import { FOCUS_RING } from './focus';
import { TreeLabel } from './tree-label';

export interface CheckboxTreeOption extends TreeOption {}

export interface CheckboxTreeProps extends FieldControlProps {
  value: string[];
  /** Always the canonical value for `mode` (see `canonicalTreeValue`). */
  onChange(value: string[]): void;
  onBlur?(): void;
  /** Flat depth-first list; `depth` 0 is a root. */
  options: CheckboxTreeOption[];
  mode: TreeMode;
  /** Start with every parent open; otherwise only the roots render. */
  defaultExpanded?: boolean;
  /** Accessible name of the tree. */
  label: string;
  disabled?: boolean;
  readOnly?: boolean;
}

const HEADER_BUTTON =
  'br:rounded-input br:px-2 br:py-1 br:text-sm br:font-medium br:text-accent-tint-text br:transition-colors br:duration-fast br:enabled:hover:bg-accent-tint br:disabled:cursor-not-allowed br:disabled:opacity-50';

/**
 * Checkbox tree (WAI-ARIA tree with `aria-checked`, partial parents are `mixed`). Collapsed
 * subtrees are not mounted. A locked node (see checkbox-tree-model.ts) cannot be changed.
 */
export function CheckboxTree({
  value,
  onChange,
  onBlur,
  options,
  mode,
  defaultExpanded = false,
  label,
  disabled,
  readOnly,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: CheckboxTreeProps) {
  const { t } = useBrume();
  const shape = useMemo(() => treeShape(options, mode), [options, mode]);
  const canonical = useMemo(() => canonicalTreeValue(options, value, mode), [options, value, mode]);
  const states = useMemo(
    () => treeCheckStates(options, canonical, mode),
    [options, canonical, mode],
  );
  const sets = useMemo(() => {
    const size = new Array<number>(shape.n).fill(0);
    const pos = new Array<number>(shape.n).fill(0);
    const counter = new Map<number, number>();
    for (let i = 0; i < shape.n; i++) {
      const p = shape.parent[i] as number;
      const k = (counter.get(p) ?? 0) + 1;
      counter.set(p, k);
      pos[i] = k;
    }
    for (let i = 0; i < shape.n; i++) size[i] = counter.get(shape.parent[i] as number) ?? 0;
    return { size, pos };
  }, [shape]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        defaultExpanded ? options.filter((_, i) => shape.isParent[i]).map((o) => o.value) : [],
      ),
  );
  const [active, setActive] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const focusNext = useRef<string | null>(null);
  const locked = Boolean(disabled || readOnly);
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);

  const visible = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < shape.n; ) {
      out.push(i);
      i =
        shape.isParent[i] && !expanded.has((options[i] as TreeOption).value)
          ? (shape.end[i] as number)
          : i + 1;
    }
    return out;
  }, [shape, expanded, options]);

  const parents = useMemo(
    () => options.filter((_, i) => shape.isParent[i]).map((o) => o.value),
    [options, shape],
  );
  const allOpen = parents.length > 0 && parents.every((p) => expanded.has(p));

  // Roving tabindex: the active node, or its nearest visible ancestor, or the first node.
  const visibleSet = useMemo(() => new Set(visible), [visible]);
  let tabIndexNode = visible[0] ?? -1;
  if (active !== null) {
    let i = shape.index.get(active) ?? -1;
    while (i >= 0 && !visibleSet.has(i)) i = shape.parent[i] as number;
    if (i >= 0) tabIndexNode = i;
  }

  useLayoutEffect(() => {
    const target = focusNext.current;
    if (target === null) return;
    focusNext.current = null;
    refs.current.get(target)?.focus();
  });

  const emit = (next: string[]) => onChange(next);
  const toggle = (i: number) => {
    const o = options[i] as TreeOption;
    if (locked || shape.locked[i]) return;
    emit(toggleTreeNode(options, canonical, o.value, mode));
  };
  const setOpen = (i: number, open: boolean) => {
    const v = (options[i] as TreeOption).value;
    setExpanded((s) => {
      const next = new Set(s);
      if (open) next.add(v);
      else next.delete(v);
      return next;
    });
  };
  const goto = (i: number) => {
    const v = (options[i] as TreeOption).value;
    setActive(v);
    focusNext.current = v;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, i: number) => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    const at = visible.indexOf(i);
    const open = shape.isParent[i] && expanded.has((options[i] as TreeOption).value);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (at < visible.length - 1) goto(visible[at + 1] as number);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (at > 0) goto(visible[at - 1] as number);
        break;
      case 'Home':
        e.preventDefault();
        goto(visible[0] as number);
        break;
      case 'End':
        e.preventDefault();
        goto(visible[visible.length - 1] as number);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (!shape.isParent[i]) break;
        if (!open) setOpen(i, true);
        else goto(i + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (open) setOpen(i, false);
        else if ((shape.parent[i] as number) >= 0) goto(shape.parent[i] as number);
        break;
      case ' ':
        e.preventDefault();
        toggle(i);
        break;
    }
  };

  const toggleableAll =
    !locked &&
    options.some((_, i) => !shape.locked[i] && (mode === 'independent' || !shape.isParent[i]));
  const everySelected = treeAllSelected(options, canonical, mode);

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would need a visible legend; the group is named by aria-label.
    <div
      id={id}
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className="br:flex br:min-w-0 br:flex-col br:gap-1"
    >
      <div className="br:flex br:flex-wrap br:items-center br:gap-1">
        <button
          type="button"
          disabled={!toggleableAll}
          onClick={() => emit(toggleTreeAll(options, canonical, mode))}
          className={cn(HEADER_BUTTON, FOCUS_RING)}
        >
          {everySelected ? t('tree.clearAll') : t('tree.selectAll')}
        </button>
        <button
          type="button"
          disabled={disabled || parents.length === 0}
          onClick={() => setExpanded(allOpen ? new Set() : new Set(parents))}
          className={cn(HEADER_BUTTON, FOCUS_RING)}
        >
          {allOpen ? t('tree.collapseAll') : t('tree.expandAll')}
        </button>
      </div>
      <div
        role="tree"
        aria-label={label}
        aria-multiselectable="true"
        aria-describedby={describedBy}
        aria-invalid={isInvalid || undefined}
        aria-required={ariaOn(ariaRequired) || undefined}
        aria-disabled={disabled || undefined}
        onBlur={onBlur}
        className={cn(
          'br:max-h-80 br:overflow-y-auto br:rounded-input br:border br:bg-surface br:p-1',
          isInvalid ? 'br:border-danger' : 'br:border-border-strong',
          disabled && 'br:opacity-50',
        )}
      >
        {options.length === 0 ? (
          <p className="br:m-0 br:px-2 br:py-1.5 br:text-sm br:text-text-muted">
            {t('tree.empty')}
          </p>
        ) : null}
        {visible.map((i) => {
          const o = options[i] as TreeOption;
          const parent = shape.isParent[i] as boolean;
          const open = parent && expanded.has(o.value);
          const check = states.get(o.value) ?? false;
          const itemLocked = Boolean(shape.locked[i]);
          return (
            <div
              key={o.value}
              ref={(el) => {
                if (el) refs.current.set(o.value, el);
                else refs.current.delete(o.value);
              }}
              role="treeitem"
              tabIndex={!disabled && i === tabIndexNode ? 0 : -1}
              aria-level={o.depth + 1}
              aria-setsize={sets.size[i]}
              aria-posinset={sets.pos[i]}
              aria-expanded={parent ? open : undefined}
              aria-checked={check === 'mixed' ? 'mixed' : check}
              aria-disabled={itemLocked || undefined}
              onFocus={(e) => {
                if (e.target === e.currentTarget) setActive(o.value);
              }}
              onKeyDown={(e) => onKeyDown(e, i)}
              onClick={() => {
                setActive(o.value);
                toggle(i);
              }}
              className={cn(
                'br:flex br:min-w-0 br:cursor-default br:select-none br:items-center br:rounded-[6px] br:px-1 br:py-1 br:text-sm br:text-text',
                itemLocked && 'br:opacity-50',
                'br:aria-[checked=true]:text-text',
                FOCUS_RING,
              )}
            >
              <TreeLabel depth={o.depth}>
                <span className="br:inline-flex br:min-w-0 br:items-center br:gap-2">
                  {parent ? (
                    <span
                      aria-hidden="true"
                      data-testid={`tree-toggle-${o.value}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) setOpen(i, !open);
                      }}
                      className="br:flex br:size-5 br:shrink-0 br:items-center br:justify-center br:text-text-muted"
                    >
                      <ChevronRight
                        className={cn(
                          'br:size-4 br:transition-transform br:duration-fast br:motion-reduce:transition-none',
                          open && 'br:rotate-90',
                        )}
                      />
                    </span>
                  ) : (
                    <span aria-hidden="true" className="br:size-5 br:shrink-0" />
                  )}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'br:flex br:size-5 br:shrink-0 br:items-center br:justify-center br:rounded-[6px] br:border',
                      check === false
                        ? 'br:border-border-strong br:bg-surface'
                        : 'br:border-accent br:bg-accent br:text-text-on-accent',
                    )}
                  >
                    {check === true ? <Check className="br:size-3.5" strokeWidth={3} /> : null}
                    {check === 'mixed' ? <Minus className="br:size-3.5" strokeWidth={3} /> : null}
                  </span>
                  <span className="br:min-w-0 br:truncate">{o.label}</span>
                </span>
              </TreeLabel>
            </div>
          );
        })}
      </div>
    </div>
  );
}
