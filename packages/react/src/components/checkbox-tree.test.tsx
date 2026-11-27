import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { CheckboxTree, type CheckboxTreeProps } from './checkbox-tree';
import { TREE_FIXTURE } from './checkbox-tree-model.fixture';

function Harness(props: Partial<CheckboxTreeProps> & { onSpy?(v: string[]): void }) {
  const { onSpy, value: initial, ...rest } = props;
  const [value, setValue] = useState<string[]>(initial ?? []);
  return (
    <CheckboxTree
      label="權限"
      options={TREE_FIXTURE}
      mode="leaves"
      {...rest}
      value={value}
      onChange={(v) => {
        onSpy?.(v);
        setValue(v);
      }}
    />
  );
}
function setup(props: Parameters<typeof Harness>[0] = {}) {
  return render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <Harness {...props} />
    </BrumeProvider>,
  );
}
const item = (name: string) => screen.getByRole('treeitem', { name: new RegExp(`^${name}$`) });
const items = () => screen.queryAllByRole('treeitem');

describe('CheckboxTree', () => {
  it('renders only the roots by default and every parent open with defaultExpanded', () => {
    const { unmount } = setup();
    expect(items().map((i) => i.textContent)).toEqual(['A', 'B', 'C', 'D']);
    unmount();
    setup({ defaultExpanded: true });
    expect(items()).toHaveLength(TREE_FIXTURE.length);
  });

  it('exposes tree semantics', () => {
    setup({ defaultExpanded: true, value: ['a1'] });
    expect(screen.getByRole('tree', { name: '權限' })).toBeTruthy();
    expect(item('A').getAttribute('aria-expanded')).toBe('true');
    expect(item('A').getAttribute('aria-checked')).toBe('mixed');
    expect(item('A1').getAttribute('aria-checked')).toBe('true');
    expect(item('B').getAttribute('aria-checked')).toBe('false');
    expect(item('B').getAttribute('aria-expanded')).toBeNull();
    expect(item('A2x').getAttribute('aria-level')).toBe('3');
    expect(item('A2').getAttribute('aria-posinset')).toBe('2');
    expect(item('A2').getAttribute('aria-setsize')).toBe('2');
    expect(item('C2').getAttribute('aria-disabled')).toBe('true');
  });

  it('has a single tab stop', () => {
    setup({ defaultExpanded: true });
    expect(items().filter((i) => i.tabIndex === 0)).toHaveLength(1);
  });

  it('clicking a parent cascades to its enabled leaves and emits the canonical value', () => {
    const spy = vi.fn();
    setup({ onSpy: spy });
    fireEvent.click(item('A'));
    expect(spy).toHaveBeenLastCalledWith(['a1', 'a2x', 'a2y']);
    expect(item('A').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(item('A'));
    expect(spy).toHaveBeenLastCalledWith([]);
  });

  it('disabled nodes cannot be toggled and are skipped by cascade', () => {
    const spy = vi.fn();
    setup({ defaultExpanded: true, onSpy: spy });
    fireEvent.click(item('C2'));
    fireEvent.click(item('D1'));
    fireEvent.click(item('D'));
    expect(spy).not.toHaveBeenCalled();
    fireEvent.click(item('C'));
    expect(spy).toHaveBeenLastCalledWith(['c1']);
  });

  it('select all skips disabled nodes; the header toggles its label', () => {
    const spy = vi.fn();
    setup({ onSpy: spy });
    fireEvent.click(screen.getByRole('button', { name: '全選' }));
    expect(spy).toHaveBeenLastCalledWith(['a1', 'a2x', 'a2y', 'b', 'c1']);
    fireEvent.click(screen.getByRole('button', { name: '取消全選' }));
    expect(spy).toHaveBeenLastCalledWith([]);
  });

  it('expand all / collapse all', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '全部展開' }));
    expect(items()).toHaveLength(TREE_FIXTURE.length);
    fireEvent.click(screen.getByRole('button', { name: '全部收合' }));
    expect(items()).toHaveLength(4);
  });

  it('shows a canonical value for a stored parent id, an unknown id and an ex-parent', () => {
    setup({ defaultExpanded: true, value: ['a', 'ghost'] });
    expect(item('A').getAttribute('aria-checked')).toBe('true');
    expect(item('A2y').getAttribute('aria-checked')).toBe('true');
  });

  it('all mode checks the parent when its leaves are all checked', () => {
    const spy = vi.fn();
    setup({ mode: 'all', defaultExpanded: true, onSpy: spy });
    fireEvent.click(item('A2'));
    expect(spy).toHaveBeenLastCalledWith(['a2', 'a2x', 'a2y']);
    fireEvent.click(item('A1'));
    expect(spy).toHaveBeenLastCalledWith(['a', 'a1', 'a2', 'a2x', 'a2y']);
  });

  it('independent mode does not cascade', () => {
    const spy = vi.fn();
    setup({ mode: 'independent', defaultExpanded: true, onSpy: spy });
    fireEvent.click(item('A'));
    expect(spy).toHaveBeenLastCalledWith(['a']);
    expect(item('A1').getAttribute('aria-checked')).toBe('false');
  });

  it('keyboard: arrows move, Right/Left open and close, Home/End, Space toggles', () => {
    const spy = vi.fn();
    setup({ onSpy: spy });
    const a = item('A');
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(a.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(item('A1'));
    fireEvent.keyDown(item('A1'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('A2'));
    fireEvent.keyDown(item('A2'), { key: 'ArrowRight' });
    expect(item('A2').getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(item('A2'), { key: 'ArrowLeft' });
    expect(item('A2').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(item('A2'));
    fireEvent.keyDown(item('A2'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(item('A'));
    fireEvent.keyDown(item('A'), { key: 'End' });
    expect(document.activeElement).toBe(item('D'));
    fireEvent.keyDown(item('D'), { key: 'Home' });
    expect(document.activeElement).toBe(item('A'));
    fireEvent.keyDown(item('A'), { key: ' ' });
    expect(spy).toHaveBeenLastCalledWith(['a1', 'a2x', 'a2y']);
    fireEvent.keyDown(item('A'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item('A'));
  });

  it('readOnly blocks toggling; disabled has no tab stop', () => {
    const spy = vi.fn();
    const { unmount } = setup({ readOnly: true, onSpy: spy });
    fireEvent.click(item('B'));
    expect(spy).not.toHaveBeenCalled();
    unmount();
    setup({ disabled: true });
    expect(items().every((i) => i.tabIndex === -1)).toBe(true);
  });

  it('mounts only the visible nodes of a 2,000 node tree', () => {
    const options = [];
    for (let r = 0; r < 40; r++) {
      options.push({ value: `r${r}`, label: `R${r}`, depth: 0 });
      for (let c = 0; c < 49; c++)
        options.push({ value: `r${r}c${c}`, label: `C${r}-${c}`, depth: 1 });
    }
    expect(options).toHaveLength(2000);
    setup({ options });
    expect(items()).toHaveLength(40);
    fireEvent.click(
      screen
        .getByRole('treeitem', { name: 'R0' })
        .querySelector('[data-testid^=tree-toggle]') as Element,
    );
    expect(items()).toHaveLength(40 + 49);
  });
});
