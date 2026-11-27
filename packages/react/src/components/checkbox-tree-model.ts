/**
 * Canonical value of a checkbox tree. The PHP server implements these same rules; the shared
 * table-driven cases live in `packages/schema/fixtures/tree/canonical.json` (each case carries
 * its own options).
 *
 * Options are a flat depth-first list (`depth` 0 = root, each depth at most previous + 1, values
 * unique). A node is a PARENT iff the next option is deeper; every other node is a LEAF. The
 * leaves of a parent are all leaf nodes in its subtree.
 *
 * INVALID OPTIONS: a list that breaks the invariants above (first depth not 0, a depth more than
 * previous + 1, a negative or non-integer depth, duplicate values) is a declaration error rejected
 * upstream (schema `findTreeOptionErrors` and the server). The behaviour of every function here on
 * such input is unspecified.
 *
 * LOCKED nodes: in modes `leaves` and `all` a node is locked when it is `disabled` or has a
 * disabled ancestor (a disabled node freezes its whole subtree). In `independent` only a node's
 * own `disabled` locks it (there is no cascade). A locked node's checked state can never change
 * through the UI, cascade or select-all, and expansion below never adds a locked leaf. A locked
 * leaf already in the value stays in it.
 *
 * `canonicalTreeValue(options, value, mode)`; output order is always the options order (depth
 * first), without duplicates, and unknown ids are dropped:
 * - `independent`: the known ids, nothing else changes.
 * - `leaves`: every parent id present is replaced by all of its UNLOCKED leaves; the output holds
 *   leaf ids only. (A parent whose leaves are all locked expands to nothing and its id is dropped.)
 * - `all`: expand parent ids as in `leaves`, then add every parent whose leaves are ALL present
 *   (locked leaves must be present themselves). Output = those parents + the leaves present.
 *   A parent id with a missing locked leaf is therefore not kept.
 * - Toggling (UI only): a parent is "all on" when every UNLOCKED leaf below it is on; then a click
 *   turns those leaves off, otherwise on. Locked leaves are ignored, so a parent with a locked-off
 *   leaf shows `mixed` (never fully checked) yet a click with all unlocked leaves on unchecks them.
 *   A parent without unlocked leaves does nothing.
 * - A node that used to be a parent and is now a leaf is just a leaf.
 */

export type TreeMode = 'leaves' | 'all' | 'independent';

export interface TreeOption {
  value: string;
  label: string;
  depth: number;
  disabled?: boolean;
}

export type TreeCheck = boolean | 'mixed';

export interface TreeShape {
  n: number;
  /** Index after the last descendant. */
  end: number[];
  parent: number[];
  isParent: boolean[];
  locked: boolean[];
  index: Map<string, number>;
}

export function treeShape(options: readonly TreeOption[], mode: TreeMode): TreeShape {
  const n = options.length;
  const end = new Array<number>(n).fill(n);
  const parent = new Array<number>(n).fill(-1);
  const isParent = new Array<boolean>(n).fill(false);
  const locked = new Array<boolean>(n).fill(false);
  const index = new Map<string, number>();
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    const o = options[i] as TreeOption;
    while (
      stack.length > 0 &&
      (options[stack[stack.length - 1] as number] as TreeOption).depth >= o.depth
    ) {
      end[stack.pop() as number] = i;
    }
    const p = stack.length > 0 ? (stack[stack.length - 1] as number) : -1;
    parent[i] = p;
    if (p >= 0) isParent[p] = true;
    locked[i] = Boolean(o.disabled) || (mode !== 'independent' && p >= 0 && (locked[p] as boolean));
    if (!index.has(o.value)) index.set(o.value, i);
    stack.push(i);
  }
  return { n, end, parent, isParent, locked, index };
}

function checkedIndexes(shape: TreeShape, value: readonly string[]) {
  const on = new Array<boolean>(shape.n).fill(false);
  for (const id of value) {
    const i = shape.index.get(id);
    if (i !== undefined) on[i] = true;
  }
  return on;
}

/** Leaves-mode semantics on indexes: parents expanded to unlocked leaves. Returns leaf flags. */
function expandLeaves(shape: TreeShape, on: boolean[]): boolean[] {
  const leaf = new Array<boolean>(shape.n).fill(false);
  for (let i = 0; i < shape.n; i++) {
    if (!on[i]) continue;
    if (!shape.isParent[i]) {
      leaf[i] = true;
      continue;
    }
    for (let j = i + 1; j < (shape.end[i] as number); j++) {
      if (!shape.isParent[j] && !shape.locked[j]) leaf[j] = true;
    }
  }
  return leaf;
}

/** Per parent: are all its leaves set in `leaf`. Index-aligned; false for non-parents. */
function fullParents(shape: TreeShape, leaf: boolean[]): boolean[] {
  const prefixOn = new Array<number>(shape.n + 1).fill(0);
  const prefixAll = new Array<number>(shape.n + 1).fill(0);
  for (let i = 0; i < shape.n; i++) {
    const isLeaf = !shape.isParent[i];
    prefixAll[i + 1] = (prefixAll[i] as number) + (isLeaf ? 1 : 0);
    prefixOn[i + 1] = (prefixOn[i] as number) + (isLeaf && leaf[i] ? 1 : 0);
  }
  return shape.isParent.map((p, i) => {
    if (!p) return false;
    const e = shape.end[i] as number;
    return (
      (prefixOn[e] as number) - (prefixOn[i + 1] as number) ===
      (prefixAll[e] as number) - (prefixAll[i + 1] as number)
    );
  });
}

export function canonicalTreeValue(
  options: readonly TreeOption[],
  value: readonly string[],
  mode: TreeMode,
): string[] {
  const shape = treeShape(options, mode);
  const on = checkedIndexes(shape, value);
  if (mode === 'independent') {
    return options.filter((_, i) => on[i]).map((o) => o.value);
  }
  const leaf = expandLeaves(shape, on);
  const full = mode === 'all' ? fullParents(shape, leaf) : [];
  const out: string[] = [];
  for (let i = 0; i < shape.n; i++) {
    if (shape.isParent[i] ? full[i] : leaf[i]) out.push((options[i] as TreeOption).value);
  }
  return out;
}

/** Checked state of every node for the given (any) value, as the UI shows it. */
export function treeCheckStates(
  options: readonly TreeOption[],
  value: readonly string[],
  mode: TreeMode,
): Map<string, TreeCheck> {
  const shape = treeShape(options, mode);
  const on = checkedIndexes(shape, value);
  const states = new Map<string, TreeCheck>();
  if (mode === 'independent') {
    options.forEach((o, i) => {
      states.set(o.value, on[i] as boolean);
    });
    return states;
  }
  const leaf = expandLeaves(shape, on);
  const prefix = new Array<number>(shape.n + 1).fill(0);
  for (let i = 0; i < shape.n; i++) {
    prefix[i + 1] = (prefix[i] as number) + (!shape.isParent[i] && leaf[i] ? 1 : 0);
  }
  const full = fullParents(shape, leaf);
  options.forEach((o, i) => {
    if (!shape.isParent[i]) {
      states.set(o.value, leaf[i] as boolean);
    } else if (full[i]) {
      states.set(o.value, true);
    } else {
      const any = (prefix[shape.end[i] as number] as number) - (prefix[i + 1] as number) > 0;
      states.set(o.value, any ? 'mixed' : false);
    }
  });
  return states;
}

function toggleSet(
  options: readonly TreeOption[],
  value: readonly string[],
  mode: TreeMode,
  targets: number[],
  shape: TreeShape,
): string[] {
  const leafMode = mode !== 'independent';
  const on = checkedIndexes(shape, value);
  const leaf = leafMode ? expandLeaves(shape, on) : on;
  const movable = targets.filter((i) => !shape.locked[i] && !(leafMode && shape.isParent[i]));
  if (movable.length === 0) return canonicalTreeValue(options, value, mode);
  const allOn = movable.every((i) => leaf[i]);
  const next = leaf.slice();
  for (const i of movable) next[i] = !allOn;
  return canonicalTreeValue(
    options,
    options.filter((_, i) => next[i] && (!leafMode || !shape.isParent[i])).map((o) => o.value),
    mode,
  );
}

/** Whether select-all would clear (every unlocked node is already selected) rather than select. */
export function treeAllSelected(
  options: readonly TreeOption[],
  value: readonly string[],
  mode: TreeMode,
): boolean {
  const shape = treeShape(options, mode);
  const on = checkedIndexes(shape, value);
  const leaf = mode === 'independent' ? on : expandLeaves(shape, on);
  let any = false;
  for (let i = 0; i < shape.n; i++) {
    if (shape.locked[i] || (mode !== 'independent' && shape.isParent[i])) continue;
    any = true;
    if (!leaf[i]) return false;
  }
  return any;
}

/** Value after the user toggles one node. A locked node changes nothing. */
export function toggleTreeNode(
  options: readonly TreeOption[],
  value: readonly string[],
  id: string,
  mode: TreeMode,
): string[] {
  const shape = treeShape(options, mode);
  const i = shape.index.get(id);
  if (i === undefined || shape.locked[i]) return canonicalTreeValue(options, value, mode);
  if (mode === 'independent' || !shape.isParent[i]) {
    return toggleSet(options, value, mode, [i], shape);
  }
  const leaves: number[] = [];
  for (let j = i + 1; j < (shape.end[i] as number); j++) if (!shape.isParent[j]) leaves.push(j);
  return toggleSet(options, value, mode, leaves, shape);
}

/** Select every unlocked node, or clear them when all are already selected. Locked ones keep their state. */
export function toggleTreeAll(
  options: readonly TreeOption[],
  value: readonly string[],
  mode: TreeMode,
): string[] {
  const shape = treeShape(options, mode);
  const targets: number[] = [];
  for (let i = 0; i < shape.n; i++)
    if (mode === 'independent' || !shape.isParent[i]) targets.push(i);
  return toggleSet(options, value, mode, targets, shape);
}
