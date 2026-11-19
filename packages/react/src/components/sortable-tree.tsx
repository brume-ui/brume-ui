import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  MeasuringStrategy,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, GripVertical } from 'lucide-react';
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../cn';
import { prefersReducedMotion } from '../motion/reduced-motion';
import { useBrume } from '../provider';
import { DragHandle } from './drag-handle';
import { FOCUS_RING } from './focus';
import {
  applyMove,
  depthMap,
  type KeyboardStep,
  keyboardMove,
  moveFromProjection,
  moveOf,
  projectDrop,
  sameTree,
  type TreeMove,
  type TreeNode,
  visibleNodes,
} from './sortable-tree-model';
import { TREE_ELBOW_REM, TREE_STEP_REM, TreeElbow } from './tree-label';
import { useSortableSensors } from './use-sortable-setup';

export type { TreeNode } from './sortable-tree-model';

export interface SortableTreeProps<T extends TreeNode> {
  /** Every node, flat and depth-first; a root has `parent: null`. */
  nodes: T[];
  /** A node's content (name, badges, actions); the handle and collapse toggle come with the row. */
  renderNode(node: T, state: { depth: number; hasChildren: boolean }): ReactNode;
  /** Deepest level a node may sit on (roots are level 1). */
  maxDepth?: number;
  /** Off: the handles are disabled; the tree still renders and collapses. */
  enabled: boolean;
  /**
   * A node was dropped somewhere new: under `parent` (`null` = top level), right after the sibling
   * `after`, or as the first child right before `before`; neither when it is the only child.
   */
  onMove(move: TreeMove): void;
  /** Controlled collapse; when omitted every node starts expanded. */
  collapsed?: ReadonlySet<string>;
  onCollapsedChange?(collapsed: Set<string>): void;
  /** The node's name for its handle, toggle and announcements; defaults to its id. */
  nodeLabel?(node: T): string;
}

/** The row's horizontal padding (`px-1`), before its handle. */
const ROW_PAD_REM = 0.25;
const indentRem = (depth: number) => (depth <= 1 ? 0 : (depth - 2) * TREE_STEP_REM);
/** Where a row's handle starts, measured from the row's edge: padding, the level's indent and elbow. */
const handleStartRem = (depth: number) =>
  ROW_PAD_REM + (depth <= 1 ? 0 : indentRem(depth) + TREE_ELBOW_REM);

/** One level of horizontal drag, in pixels. */
function levelWidth(): number {
  const root =
    typeof document === 'undefined'
      ? 16
      : Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return (Number.isFinite(root) && root > 0 ? root : 16) * TREE_STEP_REM;
}

interface PointerDrag {
  activeId: string;
  overId: string;
  offsetX: number;
}

function TreeRow({
  id,
  depth,
  hasChildren,
  expanded,
  setSize,
  posInSet,
  label,
  enabled,
  carried,
  dropDepth,
  onToggle,
  onHandleKeyDown,
  onHandleBlur,
  handleRef,
  children,
}: {
  id: string;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  setSize: number;
  posInSet: number;
  label: string;
  enabled: boolean;
  carried: boolean;
  /** While this row is the pointer drag's placeholder: the drop line's level, `null` if illegal. */
  dropDepth: number | null | undefined;
  onToggle(): void;
  onHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void;
  onHandleBlur(event: FocusEvent<HTMLButtonElement>): void;
  handleRef(node: HTMLButtonElement | null): void;
  children: ReactNode;
}) {
  const { t } = useBrume();
  const reduced = prefersReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !enabled, transition: reduced ? null : undefined });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition: reduced ? undefined : transition,
  };
  const aria = { 'aria-level': depth, 'aria-setsize': setSize, 'aria-posinset': posInSet };

  if (isDragging) {
    // The dragged row stays in the list as a placeholder showing where it will land.
    return (
      <li ref={setNodeRef} style={style} {...aria} className="br:flex br:h-10 br:items-center">
        {dropDepth != null ? (
          <span
            data-drop-line=""
            className="br:h-0.5 br:flex-1 br:rounded-full br:bg-accent"
            style={{ marginInlineStart: `${handleStartRem(dropDepth)}rem` }}
          />
        ) : null}
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} {...aria} data-carried={carried || undefined}>
      <div
        className={cn(
          'br:flex br:min-h-10 br:items-center br:gap-1 br:rounded-input br:px-1',
          carried && 'br:bg-accent-tint br:outline-2 br:outline-accent br:outline-dashed',
        )}
      >
        <span
          data-depth={depth}
          className="br:inline-flex br:shrink-0 br:items-center br:gap-2"
          style={{ paddingInlineStart: `${indentRem(depth)}rem` }}
        >
          {depth > 1 ? <TreeElbow /> : null}
          <DragHandle
            ref={(node) => {
              setActivatorNodeRef(node);
              handleRef(node);
            }}
            label={t('dataTable.dragHandle', { label })}
            disabled={!enabled}
            {...(enabled
              ? {
                  ...attributes,
                  ...listeners,
                  'aria-pressed': carried || undefined,
                  onKeyDown: onHandleKeyDown,
                  onBlur: onHandleBlur,
                }
              : {})}
          />
        </span>
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={t('sortableTree.toggle', { label })}
            onClick={onToggle}
            className={cn(
              'br:inline-flex br:size-7 br:shrink-0 br:items-center br:justify-center br:rounded-input br:text-text-muted br:hover:bg-surface-canvas br:hover:text-text',
              FOCUS_RING,
            )}
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                'br:size-4 br:transition-transform br:duration-fast br:motion-reduce:transition-none',
                expanded && 'br:rotate-90',
              )}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="br:size-7 br:shrink-0" />
        )}
        <div className="br:min-w-0 br:flex-1 br:py-1.5">{children}</div>
      </div>
    </li>
  );
}

/**
 * A hierarchy reordered by dragging: up and down moves a node among its neighbours, and the
 * horizontal distance moves it in or out a level (one level per 1.25rem, the TreeLabel indent).
 * The node carries its subtree. Keyboard: Space/Enter picks the focused handle's node up, ↑/↓
 * step through the visible slots, → nests it under the sibling above, ← moves it out after its
 * parent, Space/Enter drops, Esc cancels. Illegal spots (its own subtree, past `maxDepth`) show no
 * drop line and never call `onMove`.
 *
 * Rendered as one flat list whose items carry `aria-level` / `aria-setsize` / `aria-posinset`, so
 * the handles, toggles and node actions stay ordinary buttons reached with Tab.
 */
export function SortableTree<T extends TreeNode>({
  nodes: nodesProp,
  renderNode,
  maxDepth,
  enabled,
  onMove,
  collapsed: collapsedProp,
  onCollapsedChange,
  nodeLabel,
}: SortableTreeProps<T>) {
  const { t } = useBrume();
  const [ownCollapsed, setOwnCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const collapsed = collapsedProp ?? ownCollapsed;
  const setCollapsed = (next: Set<string>) => {
    if (collapsedProp === undefined) setOwnCollapsed(next);
    onCollapsedChange?.(next);
  };
  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };

  // After a drop the new shape shows at once and lasts until the caller sends new nodes.
  const [optimistic, setOptimistic] = useState<{ base: T[]; list: T[] } | null>(null);
  const nodes = optimistic && optimistic.base === nodesProp ? optimistic.list : nodesProp;
  // Keyboard pick-up: the previewed tree, valid only for the nodes it started from.
  const [carry, setCarry] = useState<{ id: string; base: T[]; list: T[] } | null>(null);
  const carrying = carry && carry.base === nodes && enabled ? carry : null;
  const [drag, setDrag] = useState<PointerDrag | null>(null);
  const [message, setMessage] = useState('');

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nameOf = (id: string) => {
    const node = byId.get(id);
    return node && nodeLabel ? nodeLabel(node) : id;
  };
  const commit = (move: TreeMove) => {
    const next = applyMove(nodes, move);
    if (sameTree(nodes, next)) return;
    setOptimistic({ base: nodesProp, list: next });
    onMove(move);
  };
  /** "X moved under Y, position n" for `id` in `tree`. */
  const describe = (tree: readonly TreeNode[], id: string) => {
    const parent = tree.find((n) => n.id === id)?.parent ?? null;
    const n = tree.filter((x) => x.parent === parent).findIndex((x) => x.id === id) + 1;
    return parent === null
      ? t('sortableTree.movedRoot', { label: nameOf(id), n })
      : t('sortableTree.movedUnder', { label: nameOf(id), parent: nameOf(parent), n });
  };

  const shown = carrying?.list ?? nodes;
  const rows = visibleNodes(shown, collapsed, carrying?.id ?? drag?.activeId ?? null);
  const depths = depthMap(shown);
  const children = new Map<string | null, string[]>();
  for (const node of shown)
    children.set(node.parent, [...(children.get(node.parent) ?? []), node.id]);

  const offsetDepth = (offsetX: number) => Math.round(offsetX / levelWidth());
  const projection = drag
    ? projectDrop(nodes, drag.activeId, drag.overId, offsetDepth(drag.offsetX), maxDepth, collapsed)
    : null;

  // Keep focus on the carried node's handle as its row moves through the list.
  const handles = useRef(new Map<string, HTMLButtonElement>());
  useLayoutEffect(() => {
    if (!carrying) return;
    const handle = handles.current.get(carrying.id);
    if (handle && document.activeElement !== handle) handle.focus();
  }, [carrying]);

  const onHandleKeyDown = (id: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key;
    if (!carrying || carrying.id !== id) {
      if (key !== ' ' && key !== 'Enter') return;
      event.preventDefault();
      setCarry({ id, base: nodes, list: nodes });
      setMessage(t('dataTable.dragPickedUp', { label: nameOf(id) }));
      return;
    }
    if (key === ' ' || key === 'Enter') {
      event.preventDefault();
      if (!sameTree(nodes, carrying.list)) commit(moveOf(carrying.list, id));
      setCarry(null);
      setMessage(t('dataTable.dragDropped'));
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      setCarry(null);
      setMessage(t('dataTable.dragCancelled'));
      return;
    }
    const steps: Record<string, KeyboardStep> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const step = steps[key];
    if (!step) return;
    event.preventDefault();
    const result = keyboardMove(carrying.list, id, step, { maxDepth, collapsed });
    if ('error' in result) {
      const label = nameOf(id);
      if (result.error === 'maxDepth') {
        setMessage(t('sortableTree.maxDepth', { label, max: maxDepth ?? 0 }));
      } else if (result.error === 'noPrevSibling') {
        setMessage(t('sortableTree.noPrevSibling', { label }));
      } else if (result.error === 'root') {
        setMessage(t('sortableTree.atRoot', { label }));
      }
      return;
    }
    const { move } = result;
    // Moving into a collapsed node opens it, so the carried node stays in view.
    if (move.parent !== null && collapsed.has(move.parent)) {
      const next = new Set(collapsed);
      next.delete(move.parent);
      setCollapsed(next);
    }
    const list = applyMove(carrying.list, move);
    setCarry({ ...carrying, list });
    setMessage(describe(list, id));
  };
  // Tabbing away puts the node back; a blur with no new target is the row moving in the DOM.
  const onHandleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    if (carrying && event.relatedTarget !== null) {
      setCarry(null);
      setMessage(t('dataTable.dragCancelled'));
    }
  };

  // Pointer dragging (dnd-kit); the keyboard runs through onHandleKeyDown instead.
  const sensors = useSortableSensors({ keyboard: false });
  const dragRef = useRef<PointerDrag | null>(null);
  dragRef.current = drag;
  const describeDrop = (activeId: string, overId: string) => {
    const offset = offsetDepth(dragRef.current?.offsetX ?? 0);
    const spot = projectDrop(nodes, activeId, overId, offset, maxDepth, collapsed);
    if (!spot) return t('sortableTree.cannotDrop', { label: nameOf(activeId) });
    return describe(applyMove(nodes, moveFromProjection(activeId, spot)), activeId);
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dataTable.dragPickedUp', { label: nameOf(String(active.id)) }),
    onDragOver: ({ active, over }) =>
      over ? describeDrop(String(active.id), String(over.id)) : undefined,
    onDragEnd: () => t('dataTable.dragDropped'),
    onDragCancel: () => t('dataTable.dragCancelled'),
  };
  const onDragStart = ({ active }: DragStartEvent) => {
    setCarry(null);
    setDrag({ activeId: String(active.id), overId: String(active.id), offsetX: 0 });
  };
  const onDragMove = ({ delta }: DragMoveEvent) =>
    setDrag((d) => (d && d.offsetX !== delta.x ? { ...d, offsetX: delta.x } : d));
  const onDragOver = ({ over }: DragOverEvent) =>
    setDrag((d) => (d && over ? { ...d, overId: String(over.id) } : d));
  const onDragEnd = ({ active, over, delta }: DragEndEvent) => {
    setDrag(null);
    if (!over) return;
    const id = String(active.id);
    const spot = projectDrop(nodes, id, String(over.id), offsetDepth(delta.x), maxDepth, collapsed);
    if (spot) commit(moveFromProjection(id, spot));
  };

  const activeNode = drag ? byId.get(drag.activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('sortableTree.instructions') },
      }}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
    >
      <SortableContext items={rows.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <ul className="br:m-0 br:flex br:list-none br:flex-col br:gap-0.5 br:p-0">
          {rows.map((node) => {
            const depth = depths.get(node.id) ?? 1;
            const siblings = children.get(node.parent) ?? [];
            const hasChildren = (children.get(node.id)?.length ?? 0) > 0;
            return (
              <TreeRow
                key={node.id}
                id={node.id}
                depth={depth}
                hasChildren={hasChildren}
                expanded={!collapsed.has(node.id)}
                setSize={siblings.length}
                posInSet={siblings.indexOf(node.id) + 1}
                label={nameOf(node.id)}
                enabled={enabled}
                carried={carrying?.id === node.id}
                dropDepth={drag?.activeId === node.id ? (projection?.depth ?? null) : undefined}
                onToggle={() => toggle(node.id)}
                onHandleKeyDown={onHandleKeyDown(node.id)}
                onHandleBlur={onHandleBlur}
                handleRef={(el) => {
                  if (el) handles.current.set(node.id, el);
                  else handles.current.delete(node.id);
                }}
              >
                {renderNode(node, { depth, hasChildren })}
              </TreeRow>
            );
          })}
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={prefersReducedMotion() ? null : undefined}>
        {activeNode ? (
          <div className="br:flex br:min-h-10 br:cursor-grabbing br:items-center br:gap-1 br:rounded-input br:border br:border-border br:bg-surface br:px-1 br:shadow-overlay">
            <span className="br:inline-flex br:size-7 br:shrink-0 br:items-center br:justify-center br:text-text-muted">
              <GripVertical aria-hidden="true" className="br:size-4" />
            </span>
            <div className="br:min-w-0 br:flex-1 br:py-1.5">
              {renderNode(activeNode, {
                depth: depthMap(nodes).get(activeNode.id) ?? 1,
                hasChildren: nodes.some((n) => n.parent === activeNode.id),
              })}
            </div>
          </div>
        ) : null}
      </DragOverlay>
      <div role="status" aria-live="polite" className="br:sr-only">
        {message}
      </div>
    </DndContext>
  );
}
