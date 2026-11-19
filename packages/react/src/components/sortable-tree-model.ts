/**
 * Pure tree arithmetic behind SortableTree. A tree is a flat, depth-first array of nodes that
 * name their parent (`null` for a root); depth 1 is a root.
 */

export interface TreeNode {
  id: string;
  parent: string | null;
}

/**
 * Where a node goes: under `parent`, right after the sibling `after`, or (as the first child)
 * right before `before`; neither when it becomes the only child. Never both.
 */
export interface TreeMove {
  id: string;
  parent: string | null;
  before?: string;
  after?: string;
}

export interface DropProjection {
  parent: string | null;
  depth: number;
  before?: string;
  after?: string;
}

export function depthMap(nodes: readonly TreeNode[]): Map<string, number> {
  const depths = new Map<string, number>();
  for (const node of nodes) {
    depths.set(node.id, node.parent === null ? 1 : (depths.get(node.parent) ?? 0) + 1);
  }
  return depths;
}

/** Whether `id` sits somewhere below `ancestor`. */
function isDescendant(parents: Map<string, string | null>, id: string, ancestor: string): boolean {
  const seen = new Set<string>();
  let current = parents.get(id) ?? null;
  while (current !== null && !seen.has(current)) {
    if (current === ancestor) return true;
    seen.add(current);
    current = parents.get(current) ?? null;
  }
  return false;
}

const parentMap = (nodes: readonly TreeNode[]) =>
  new Map(nodes.map((n) => [n.id, n.parent] as const));

/** The ids below `id` (not including it). */
export function descendantIds(nodes: readonly TreeNode[], id: string): Set<string> {
  const parents = parentMap(nodes);
  return new Set(nodes.filter((n) => isDescendant(parents, n.id, id)).map((n) => n.id));
}

/** Levels in the subtree rooted at `id`: 1 for a leaf, +1 per level of descendants. */
export function subtreeDepth(nodes: readonly TreeNode[], id: string): number {
  const depths = depthMap(nodes);
  const own = depths.get(id);
  if (own === undefined) return 0;
  let deepest = own;
  for (const below of descendantIds(nodes, id)) deepest = Math.max(deepest, depths.get(below) ?? 0);
  return deepest - own + 1;
}

/** The nodes on screen: no descendants of collapsed nodes, nor of the node being dragged. */
export function visibleNodes<T extends TreeNode>(
  nodes: readonly T[],
  collapsed: ReadonlySet<string>,
  hideSubtreeOf?: string | null,
): T[] {
  const parents = parentMap(nodes);
  const hidden = (id: string) => {
    let current = parents.get(id) ?? null;
    const seen = new Set<string>();
    while (current !== null && !seen.has(current)) {
      if (collapsed.has(current) || current === hideSubtreeOf) return true;
      seen.add(current);
      current = parents.get(current) ?? null;
    }
    return false;
  };
  return nodes.filter((n) => !hidden(n.id));
}

/**
 * Where `activeId` lands when dropped over `overId`, shifted `offsetDepth` levels by the
 * horizontal drag distance. The depth is clamped between what its new neighbours allow and what
 * `maxDepth` leaves for its subtree. `null` when the drop is illegal: over its own subtree, over
 * something not on screen, or where the neighbours force its subtree past `maxDepth`.
 */
export function projectDrop(
  nodes: readonly TreeNode[],
  activeId: string,
  overId: string,
  offsetDepth: number,
  maxDepth?: number,
  collapsed: ReadonlySet<string> = new Set(),
): DropProjection | null {
  const depths = depthMap(nodes);
  const items = visibleNodes(nodes, collapsed, activeId);
  const activeIndex = items.findIndex((n) => n.id === activeId);
  const overIndex = items.findIndex((n) => n.id === overId);
  if (activeIndex < 0 || overIndex < 0) return null;

  const moved = items.slice();
  const [active] = moved.splice(activeIndex, 1);
  moved.splice(overIndex, 0, active as TreeNode);
  const depthOf = (n: TreeNode | undefined) => (n ? (depths.get(n.id) ?? 1) : 0);
  const prev = moved[overIndex - 1];
  const next = moved[overIndex + 1];

  let max = prev ? depthOf(prev) + 1 : 1;
  const min = next ? depthOf(next) : 1;
  if (maxDepth !== undefined) max = Math.min(max, maxDepth - subtreeDepth(nodes, activeId) + 1);
  if (min > max) return null;
  const depth = Math.min(max, Math.max(min, (depths.get(activeId) ?? 1) + offsetDepth));

  let parent: string | null = null;
  let after: string | undefined;
  for (let i = overIndex - 1; i >= 0; i--) {
    const item = moved[i] as TreeNode;
    const d = depthOf(item);
    if (d === depth) {
      after = item.id;
      parent = item.parent;
      break;
    }
    if (d === depth - 1) {
      parent = item.id;
      break;
    }
  }

  const result: DropProjection = { parent, depth };
  if (after !== undefined) {
    result.after = after;
    return result;
  }
  for (let i = overIndex + 1; i < moved.length; i++) {
    const item = moved[i] as TreeNode;
    const d = depthOf(item);
    if (d < depth) break;
    if (d === depth) {
      result.before = item.id;
      return result;
    }
  }
  // A collapsed parent hides its children: join them at the end.
  if (parent !== null && collapsed.has(parent)) {
    const children = nodes.filter((n) => n.parent === parent && n.id !== activeId);
    const last = children[children.length - 1];
    if (last) result.after = last.id;
  }
  return result;
}

/** The `onMove` payload for dropping `id` where `projection` says. */
export function moveFromProjection(id: string, projection: DropProjection): TreeMove {
  const move: TreeMove = { id, parent: projection.parent };
  if (projection.after !== undefined) move.after = projection.after;
  else if (projection.before !== undefined) move.before = projection.before;
  return move;
}

/** The tree after moving `move.id` (with its subtree) to the spot `move` names. */
export function applyMove<T extends TreeNode>(nodes: readonly T[], move: TreeMove): T[] {
  const parents = parentMap(nodes);
  const block = nodes.filter((n) => n.id === move.id || isDescendant(parents, n.id, move.id));
  const moving = new Set(block.map((n) => n.id));
  const rest = nodes.filter((n) => !moving.has(n.id));
  let at: number;
  if (move.after !== undefined) {
    const anchor = move.after;
    at = rest.findIndex((n) => n.id === anchor) + 1;
    while (at > 0 && at < rest.length && isDescendant(parents, (rest[at] as T).id, anchor)) at++;
  } else if (move.before !== undefined) {
    const anchor = move.before;
    at = rest.findIndex((n) => n.id === anchor);
  } else {
    at = move.parent === null ? rest.length : rest.findIndex((n) => n.id === move.parent) + 1;
  }
  if (at < 0) at = rest.length;
  const placed = block.map((n) => (n.id === move.id ? { ...n, parent: move.parent } : n));
  return [...rest.slice(0, at), ...placed, ...rest.slice(at)];
}

/** The node's current spot, described the way `onMove` reports one. */
export function moveOf(nodes: readonly TreeNode[], id: string): TreeMove {
  const parent = nodes.find((n) => n.id === id)?.parent ?? null;
  const siblings = nodes.filter((n) => n.parent === parent);
  const index = siblings.findIndex((n) => n.id === id);
  const above = siblings[index - 1];
  if (above) return { id, parent, after: above.id };
  const below = siblings[index + 1];
  return below ? { id, parent, before: below.id } : { id, parent };
}

/** Same nodes in the same order under the same parents. */
export function sameTree(a: readonly TreeNode[], b: readonly TreeNode[]): boolean {
  return (
    a.length === b.length &&
    a.every((n, i) => n.id === (b[i] as TreeNode).id && n.parent === (b[i] as TreeNode).parent)
  );
}

export type KeyboardStep = 'up' | 'down' | 'left' | 'right';
export type KeyboardRefusal = 'edge' | 'root' | 'noPrevSibling' | 'maxDepth';

/**
 * One arrow key press while a node is picked up: ↑/↓ step to the neighbouring visible slot,
 * → nests it under its previous sibling (as the last child), ← moves it out to right after its
 * parent. Returns the move, or why the key does nothing.
 */
export function keyboardMove(
  nodes: readonly TreeNode[],
  id: string,
  step: KeyboardStep,
  options: { maxDepth?: number; collapsed: ReadonlySet<string> },
): { move: TreeMove } | { error: KeyboardRefusal } {
  const { maxDepth, collapsed } = options;
  const node = nodes.find((n) => n.id === id);
  if (!node) return { error: 'edge' };
  const toMove = (p: DropProjection) => moveFromProjection(id, p);

  if (step === 'left') {
    if (node.parent === null) return { error: 'root' };
    const grandparent = nodes.find((n) => n.id === node.parent)?.parent ?? null;
    return { move: { id, parent: grandparent, after: node.parent } };
  }

  if (step === 'right') {
    const depths = depthMap(nodes);
    const depth = depths.get(id) ?? 1;
    const items = visibleNodes(nodes, collapsed, id);
    const prev = items[items.findIndex((n) => n.id === id) - 1];
    if (!prev || (depths.get(prev.id) ?? 0) < depth) return { error: 'noPrevSibling' };
    if (maxDepth !== undefined && depth + subtreeDepth(nodes, id) > maxDepth) {
      return { error: 'maxDepth' };
    }
    const projection = projectDrop(nodes, id, id, 1, maxDepth, collapsed);
    return projection ? { move: toMove(projection) } : { error: 'maxDepth' };
  }

  // Up / down: the nearest visible slot that is legal and actually changes the tree.
  const items = visibleNodes(nodes, collapsed, id);
  const index = items.findIndex((n) => n.id === id);
  const delta = step === 'up' ? -1 : 1;
  let refusal: KeyboardRefusal = 'edge';
  for (let i = index + delta; i >= 0 && i < items.length; i += delta) {
    const projection = projectDrop(nodes, id, (items[i] as TreeNode).id, 0, maxDepth, collapsed);
    if (!projection) {
      refusal = 'maxDepth';
      continue;
    }
    const move = toMove(projection);
    if (!sameTree(nodes, applyMove(nodes, move))) return { move };
  }
  return { error: refusal };
}
