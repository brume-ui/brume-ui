import type { TreeOption } from './checkbox-tree-model';

/** Shared with the PHP server tests: same tree, same cases, same expected output. */
export const TREE_FIXTURE: TreeOption[] = [
  { value: 'a', label: 'A', depth: 0 },
  { value: 'a1', label: 'A1', depth: 1 },
  { value: 'a2', label: 'A2', depth: 1 },
  { value: 'a2x', label: 'A2x', depth: 2 },
  { value: 'a2y', label: 'A2y', depth: 2 },
  { value: 'b', label: 'B', depth: 0 },
  { value: 'c', label: 'C', depth: 0 },
  { value: 'c1', label: 'C1', depth: 1 },
  { value: 'c2', label: 'C2', depth: 1, disabled: true },
  { value: 'd', label: 'D', depth: 0, disabled: true },
  { value: 'd1', label: 'D1', depth: 1 },
];

export interface TreeCase {
  name: string;
  mode: 'leaves' | 'all' | 'independent';
  value: string[];
  expected: string[];
}

export const TREE_CASES: TreeCase[] = [
  { name: 'leaves: empty', mode: 'leaves', value: [], expected: [] },
  {
    name: 'leaves: parent expands to leaves',
    mode: 'leaves',
    value: ['a'],
    expected: ['a1', 'a2x', 'a2y'],
  },
  { name: 'leaves: nested parent', mode: 'leaves', value: ['a2'], expected: ['a2x', 'a2y'] },
  {
    name: 'leaves: unknown dropped, order = tree order',
    mode: 'leaves',
    value: ['b', 'zzz', 'a1'],
    expected: ['a1', 'b'],
  },
  { name: 'leaves: duplicates collapse', mode: 'leaves', value: ['b', 'b'], expected: ['b'] },
  { name: 'leaves: parent skips disabled leaf', mode: 'leaves', value: ['c'], expected: ['c1'] },
  {
    name: 'leaves: disabled leaf already present stays',
    mode: 'leaves',
    value: ['c2'],
    expected: ['c2'],
  },
  {
    name: 'leaves: disabled parent id expands to nothing',
    mode: 'leaves',
    value: ['d'],
    expected: [],
  },
  {
    name: 'leaves: leaf under a disabled parent stays',
    mode: 'leaves',
    value: ['d1'],
    expected: ['d1'],
  },
  {
    name: 'all: leaves of a parent add the parent',
    mode: 'all',
    value: ['a2x', 'a2y'],
    expected: ['a2', 'a2x', 'a2y'],
  },
  {
    name: 'all: cascades up through levels',
    mode: 'all',
    value: ['a1', 'a2x', 'a2y'],
    expected: ['a', 'a1', 'a2', 'a2x', 'a2y'],
  },
  {
    name: 'all: stored parent expands',
    mode: 'all',
    value: ['a'],
    expected: ['a', 'a1', 'a2', 'a2x', 'a2y'],
  },
  {
    name: 'all: partial parent not added',
    mode: 'all',
    value: ['a1', 'a2x'],
    expected: ['a1', 'a2x'],
  },
  {
    name: 'all: disabled unchecked leaf blocks the parent',
    mode: 'all',
    value: ['c1'],
    expected: ['c1'],
  },
  {
    name: 'all: disabled leaf present completes the parent',
    mode: 'all',
    value: ['c1', 'c2'],
    expected: ['c', 'c1', 'c2'],
  },
  {
    name: 'all: stored parent expands only enabled leaves',
    mode: 'all',
    value: ['c'],
    expected: ['c1'],
  },
  { name: 'all: unknown dropped', mode: 'all', value: ['nope', 'b'], expected: ['b'] },
  {
    name: 'independent: no cascade',
    mode: 'independent',
    value: ['a', 'a2x'],
    expected: ['a', 'a2x'],
  },
  {
    name: 'independent: unknown dropped, tree order, deduped',
    mode: 'independent',
    value: ['b', 'x', 'a', 'b'],
    expected: ['a', 'b'],
  },
  {
    name: 'independent: disabled stays',
    mode: 'independent',
    value: ['d', 'c2'],
    expected: ['c2', 'd'],
  },
];
