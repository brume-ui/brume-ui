import { describe, expect, it } from 'vitest';
import {
  canonicalTreeValue,
  toggleTreeAll,
  toggleTreeNode,
  treeAllSelected,
  treeCheckStates,
} from './checkbox-tree-model';
import { TREE_CASES, TREE_FIXTURE } from './checkbox-tree-model.fixture';

describe('canonicalTreeValue', () => {
  for (const c of TREE_CASES) {
    it(c.name, () => {
      expect(canonicalTreeValue(TREE_FIXTURE, c.value, c.mode)).toEqual(c.expected);
    });
  }

  it('is idempotent', () => {
    for (const c of TREE_CASES) {
      const once = canonicalTreeValue(TREE_FIXTURE, c.value, c.mode);
      expect(canonicalTreeValue(TREE_FIXTURE, once, c.mode)).toEqual(once);
    }
  });

  it('treats a former parent that is now a leaf as a leaf', () => {
    const options = [
      { value: 'a', label: 'A', depth: 0 },
      { value: 'b', label: 'B', depth: 0 },
    ];
    expect(canonicalTreeValue(options, ['b', 'a'], 'leaves')).toEqual(['a', 'b']);
  });
});

describe('treeCheckStates', () => {
  it('reports true / false / mixed', () => {
    const s = treeCheckStates(TREE_FIXTURE, ['a1', 'a2x'], 'leaves');
    expect(s.get('a')).toBe('mixed');
    expect(s.get('a2')).toBe('mixed');
    expect(s.get('a1')).toBe(true);
    expect(s.get('b')).toBe(false);
    expect(treeCheckStates(TREE_FIXTURE, ['a1', 'a2x', 'a2y'], 'leaves').get('a')).toBe(true);
  });
  it('independent never mixes', () => {
    expect(treeCheckStates(TREE_FIXTURE, ['a1'], 'independent').get('a')).toBe(false);
  });
});

describe('toggleTreeNode', () => {
  it('checks a parent through its enabled leaves, then unchecks them', () => {
    const on = toggleTreeNode(TREE_FIXTURE, [], 'a', 'leaves');
    expect(on).toEqual(['a1', 'a2x', 'a2y']);
    expect(toggleTreeNode(TREE_FIXTURE, on, 'a', 'leaves')).toEqual([]);
  });
  it('a mixed parent becomes fully checked', () => {
    expect(toggleTreeNode(TREE_FIXTURE, ['a1'], 'a', 'leaves')).toEqual(['a1', 'a2x', 'a2y']);
  });
  it('all mode adds the parents', () => {
    expect(toggleTreeNode(TREE_FIXTURE, [], 'a2', 'all')).toEqual(['a2', 'a2x', 'a2y']);
  });
  it('cascade skips disabled leaves and keeps a present one', () => {
    expect(toggleTreeNode(TREE_FIXTURE, [], 'c', 'leaves')).toEqual(['c1']);
    expect(toggleTreeNode(TREE_FIXTURE, ['c1', 'c2'], 'c', 'leaves')).toEqual(['c2']);
  });
  it('a disabled node, or a node under one, cannot be toggled', () => {
    expect(toggleTreeNode(TREE_FIXTURE, [], 'c2', 'leaves')).toEqual([]);
    expect(toggleTreeNode(TREE_FIXTURE, ['c2'], 'c2', 'leaves')).toEqual(['c2']);
    expect(toggleTreeNode(TREE_FIXTURE, [], 'd1', 'leaves')).toEqual([]);
    expect(toggleTreeNode(TREE_FIXTURE, [], 'd', 'leaves')).toEqual([]);
  });
  it('independent toggles just the node', () => {
    expect(toggleTreeNode(TREE_FIXTURE, [], 'a', 'independent')).toEqual(['a']);
    expect(toggleTreeNode(TREE_FIXTURE, ['a'], 'a', 'independent')).toEqual([]);
    expect(toggleTreeNode(TREE_FIXTURE, [], 'd', 'independent')).toEqual([]);
    expect(toggleTreeNode(TREE_FIXTURE, [], 'd1', 'independent')).toEqual(['d1']);
  });
});

describe('toggleTreeAll', () => {
  it('selects every enabled leaf, never a disabled one', () => {
    expect(toggleTreeAll(TREE_FIXTURE, [], 'leaves')).toEqual(['a1', 'a2x', 'a2y', 'b', 'c1']);
  });
  it('clears only the toggleable ones when all are selected', () => {
    expect(
      toggleTreeAll(TREE_FIXTURE, ['a1', 'a2x', 'a2y', 'b', 'c1', 'c2', 'd1'], 'leaves'),
    ).toEqual(['c2', 'd1']);
  });
  it('all mode includes parents; independent takes every enabled node', () => {
    expect(toggleTreeAll(TREE_FIXTURE, [], 'all')).toEqual([
      'a',
      'a1',
      'a2',
      'a2x',
      'a2y',
      'b',
      'c1',
    ]);
    expect(toggleTreeAll(TREE_FIXTURE, [], 'independent')).toEqual([
      'a',
      'a1',
      'a2',
      'a2x',
      'a2y',
      'b',
      'c',
      'c1',
      'd1',
    ]);
  });
});

describe('treeAllSelected', () => {
  it('is true only when every unlocked node is selected', () => {
    expect(treeAllSelected(TREE_FIXTURE, [], 'leaves')).toBe(false);
    expect(treeAllSelected(TREE_FIXTURE, ['a1', 'a2x', 'a2y', 'b'], 'leaves')).toBe(false);
    expect(treeAllSelected(TREE_FIXTURE, ['a1', 'a2x', 'a2y', 'b', 'c1'], 'leaves')).toBe(true);
  });
});
