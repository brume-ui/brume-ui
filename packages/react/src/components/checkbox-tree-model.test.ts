import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TreeMode, TreeOption } from './checkbox-tree-model';
import {
  canonicalTreeValue,
  toggleTreeAll,
  toggleTreeNode,
  treeAllSelected,
  treeCheckStates,
} from './checkbox-tree-model';

/** Shared with the PHP server tests: every case carries its own options. */
const { cases: CASES } = JSON.parse(
  readFileSync(resolve(process.cwd(), '../schema/fixtures/tree/canonical.json'), 'utf8'),
) as {
  cases: {
    name: string;
    mode: TreeMode;
    options: TreeOption[];
    value: string[];
    expected: string[];
  }[];
};
const TREE_FIXTURE = (CASES[0] as (typeof CASES)[number]).options;

describe('canonicalTreeValue', () => {
  for (const c of CASES) {
    it(c.name, () => {
      expect(canonicalTreeValue(c.options, c.value, c.mode)).toEqual(c.expected);
    });
    it(`${c.name} (idempotent)`, () => {
      expect(canonicalTreeValue(c.options, c.expected, c.mode)).toEqual(c.expected);
    });
  }

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
  it('a mixed parent with locked leaves: "all on" is judged over the unlocked leaves', () => {
    // c2 is locked and off: c can never show fully checked, but c1 on means "all on" -> uncheck.
    expect(treeCheckStates(TREE_FIXTURE, ['c1'], 'leaves').get('c')).toBe('mixed');
    expect(toggleTreeNode(TREE_FIXTURE, ['c1'], 'c', 'leaves')).toEqual([]);
    expect(toggleTreeNode(TREE_FIXTURE, [], 'c', 'leaves')).toEqual(['c1']);
    expect(toggleTreeNode(TREE_FIXTURE, ['c1'], 'c', 'all')).toEqual([]);
  });
  it('a parent whose leaves are all locked changes nothing', () => {
    expect(toggleTreeNode(TREE_FIXTURE, ['b'], 'd', 'leaves')).toEqual(['b']);
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
