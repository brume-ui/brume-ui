import { describe, expect, it } from 'vitest';
import {
  applyMove,
  depthMap,
  keyboardMove,
  moveOf,
  projectDrop,
  sameTree,
  subtreeDepth,
  type TreeNode,
  visibleNodes,
} from './sortable-tree-model';

/** `'a>b'` = node a under parent b; a bare id is a root. Depth-first order. */
const tree = (...specs: string[]): TreeNode[] =>
  specs.map((s) => {
    const [id, parent] = s.split('>');
    return { id: id as string, parent: parent ?? null };
  });

const ids = (nodes: TreeNode[]) => nodes.map((n) => n.id);

describe('depthMap / subtreeDepth', () => {
  const nodes = tree('a', 'a1>a', 'a11>a1', 'b');

  it('roots are depth 1', () => {
    expect(Object.fromEntries(depthMap(nodes))).toEqual({ a: 1, a1: 2, a11: 3, b: 1 });
  });

  it('a leaf has subtree depth 1; each level of descendants adds one', () => {
    expect(subtreeDepth(nodes, 'b')).toBe(1);
    expect(subtreeDepth(nodes, 'a11')).toBe(1);
    expect(subtreeDepth(nodes, 'a1')).toBe(2);
    expect(subtreeDepth(nodes, 'a')).toBe(3);
  });
});

describe('visibleNodes', () => {
  const nodes = tree('a', 'a1>a', 'a11>a1', 'b', 'b1>b');

  it('hides the descendants of collapsed nodes', () => {
    expect(ids(visibleNodes(nodes, new Set(['a1'])))).toEqual(['a', 'a1', 'b', 'b1']);
    expect(ids(visibleNodes(nodes, new Set(['a'])))).toEqual(['a', 'b', 'b1']);
  });

  it('hides the subtree of the node being dragged', () => {
    expect(ids(visibleNodes(nodes, new Set(), 'a'))).toEqual(['a', 'b', 'b1']);
  });
});

describe('projectDrop', () => {
  it('moves between siblings', () => {
    const nodes = tree('a', 'a1>a', 'a2>a', 'b');
    expect(projectDrop(nodes, 'b', 'a', 0)).toEqual({ parent: null, depth: 1, before: 'a' });
    expect(projectDrop(nodes, 'a2', 'a1', 0)).toEqual({ parent: 'a', depth: 2, before: 'a1' });
    expect(projectDrop(nodes, 'a1', 'a2', 0)).toEqual({ parent: 'a', depth: 2, after: 'a2' });
  });

  it('dragged onto the next node with offset +1 becomes its child', () => {
    const nodes = tree('a', 'b', 'c');
    expect(projectDrop(nodes, 'a', 'b', 1)).toEqual({ parent: 'b', depth: 2 });
  });

  it('nesting under a node with children places it after them', () => {
    const nodes = tree('a', 'a1>a', 'b');
    expect(projectDrop(nodes, 'b', 'b', 1)).toEqual({ parent: 'a', depth: 2, after: 'a1' });
  });

  it('cannot drop into its own descendants', () => {
    const nodes = tree('a', 'a1>a', 'a11>a1', 'b');
    expect(projectDrop(nodes, 'a', 'a1', 1)).toBeNull();
    expect(projectDrop(nodes, 'a', 'a11', 0)).toBeNull();
  });

  it('with maxDepth 2 a node carrying one level of children cannot land on level 2', () => {
    const nodes = tree('a', 'a1>a', 'a2>a', 'x', 'x1>x');
    // Between a1 and a2 the neighbours force level 2: x1 would end up on level 3.
    expect(projectDrop(nodes, 'x', 'a2', 0, 2)).toBeNull();
    expect(projectDrop(nodes, 'x', 'a2', 0, 3)).toEqual({ parent: 'a', depth: 2, after: 'a1' });
  });

  it('with maxDepth, a pull too far right settles on the deepest legal level', () => {
    const nodes = tree('b', 'x', 'x1>x');
    expect(projectDrop(nodes, 'x', 'x', 1, 2)).toEqual({ parent: null, depth: 1, after: 'b' });
  });

  it('moves after the last root', () => {
    const nodes = tree('a', 'a1>a', 'b', 'c');
    expect(projectDrop(nodes, 'a', 'c', 0)).toEqual({ parent: null, depth: 1, after: 'c' });
  });

  it('a pull left out of the last child outdents it', () => {
    const nodes = tree('a', 'a1>a', 'a2>a', 'b');
    expect(projectDrop(nodes, 'a2', 'a2', -1)).toEqual({ parent: null, depth: 1, after: 'a' });
    // a1 still has a sibling below it: it cannot leave the parent in place.
    expect(projectDrop(nodes, 'a1', 'a1', -1)).toEqual({ parent: 'a', depth: 2, before: 'a2' });
  });

  it('nesting under a collapsed node appends after its hidden children', () => {
    const nodes = tree('a', 'a1>a', 'a2>a', 'b');
    expect(projectDrop(nodes, 'b', 'b', 1, undefined, new Set(['a']))).toEqual({
      parent: 'a',
      depth: 2,
      after: 'a2',
    });
  });

  it('returns null for an unknown or hidden target', () => {
    const nodes = tree('a', 'a1>a', 'b');
    expect(projectDrop(nodes, 'b', 'zz', 0)).toBeNull();
    expect(projectDrop(nodes, 'b', 'a1', 0, undefined, new Set(['a']))).toBeNull();
  });
});

describe('applyMove / moveOf / sameTree', () => {
  const nodes = tree('a', 'a1>a', 'a2>a', 'b', 'b1>b');

  it('moves the node with its subtree after a sibling', () => {
    const next = applyMove(nodes, { id: 'b', parent: 'a', after: 'a1' });
    expect(ids(next)).toEqual(['a', 'a1', 'b', 'b1', 'a2']);
    expect(next.find((n) => n.id === 'b')?.parent).toBe('a');
    expect(next.find((n) => n.id === 'b1')?.parent).toBe('b');
  });

  it('after skips the whole subtree of the sibling', () => {
    expect(ids(applyMove(nodes, { id: 'a2', parent: null, after: 'b' }))).toEqual([
      'a',
      'a1',
      'b',
      'b1',
      'a2',
    ]);
    expect(ids(applyMove(nodes, { id: 'b', parent: null, after: 'a' }))).toEqual(ids(nodes));
  });

  it('before places it in front; neither makes it the only child', () => {
    expect(ids(applyMove(nodes, { id: 'b', parent: null, before: 'a' }))).toEqual([
      'b',
      'b1',
      'a',
      'a1',
      'a2',
    ]);
    expect(ids(applyMove(nodes, { id: 'a2', parent: 'b1' }))).toEqual(['a', 'a1', 'b', 'b1', 'a2']);
  });

  it('moveOf describes the current spot the way onMove reports it', () => {
    expect(moveOf(nodes, 'a1')).toEqual({ id: 'a1', parent: 'a', before: 'a2' });
    expect(moveOf(nodes, 'a2')).toEqual({ id: 'a2', parent: 'a', after: 'a1' });
    expect(moveOf(nodes, 'b1')).toEqual({ id: 'b1', parent: 'b' });
  });

  it('sameTree compares order and parents', () => {
    expect(sameTree(nodes, applyMove(nodes, moveOf(nodes, 'a2')))).toBe(true);
    expect(sameTree(nodes, applyMove(nodes, { id: 'a2', parent: 'a', before: 'a1' }))).toBe(false);
  });
});

describe('keyboardMove', () => {
  const nodes = tree('a', 'a1>a', 'b', 'c');
  const opts = { collapsed: new Set<string>() };

  it('right nests under the previous sibling as its last child', () => {
    expect(keyboardMove(nodes, 'b', 'right', opts)).toEqual({
      move: { id: 'b', parent: 'a', after: 'a1' },
    });
  });

  it('right without a previous sibling is refused', () => {
    expect(keyboardMove(nodes, 'a', 'right', opts)).toEqual({ error: 'noPrevSibling' });
    expect(keyboardMove(nodes, 'a1', 'right', opts)).toEqual({ error: 'noPrevSibling' });
  });

  it('right beyond maxDepth is refused', () => {
    const deep = tree('a', 'b', 'b1>b');
    expect(keyboardMove(deep, 'b', 'right', { ...opts, maxDepth: 2 })).toEqual({
      error: 'maxDepth',
    });
  });

  it('left moves out to right after the parent; a root cannot', () => {
    expect(keyboardMove(nodes, 'a1', 'left', opts)).toEqual({
      move: { id: 'a1', parent: null, after: 'a' },
    });
    expect(keyboardMove(nodes, 'a', 'left', opts)).toEqual({ error: 'root' });
  });

  it('up and down step through the visible positions', () => {
    expect(keyboardMove(nodes, 'c', 'up', opts)).toEqual({
      move: { id: 'c', parent: null, after: 'a' },
    });
    // The slot above a1 sits under a, so b joins a there.
    expect(keyboardMove(nodes, 'b', 'up', opts)).toEqual({
      move: { id: 'b', parent: 'a', before: 'a1' },
    });
    expect(keyboardMove(nodes, 'a', 'down', opts)).toEqual({
      move: { id: 'a', parent: null, after: 'b' },
    });
    expect(keyboardMove(nodes, 'a', 'up', opts)).toEqual({ error: 'edge' });
    expect(keyboardMove(nodes, 'c', 'down', opts)).toEqual({ error: 'edge' });
  });
});
