import { describe, expect, it } from 'vitest';
import type { ToastAction, TreeMove } from './index';

// Type-only exports: this file fails `tsc --noEmit` if the package index stops exporting them.
describe('public types', () => {
  it('exports the shapes SortableTree and toast hand to callers', () => {
    const move: TreeMove = { id: 'b', parent: 'a', after: 'a1' };
    const action: ToastAction = { label: '復原', onClick: () => {} };
    expect(move.parent).toBe('a');
    expect(action.label).toBe('復原');
  });
});
