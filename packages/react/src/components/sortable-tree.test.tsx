import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { SortableTree, type SortableTreeProps } from './sortable-tree';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

interface Item {
  id: string;
  parent: string | null;
  name: string;
}

const NODES: Item[] = [
  { id: 'a', parent: null, name: '服飾' },
  { id: 'a1', parent: 'a', name: '上衣' },
  { id: 'b', parent: null, name: '家居' },
  { id: 'b1', parent: 'b', name: '寢具' },
];

function mount(props: Partial<SortableTreeProps<Item>> = {}) {
  const onMove = vi.fn();
  render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <SortableTree<Item>
        nodes={NODES}
        enabled
        nodeLabel={(n) => n.name}
        renderNode={(n, { depth }) => (
          <span data-testid={`node-${n.id}`}>
            {n.name}（{depth}）
          </span>
        )}
        onMove={onMove}
        {...props}
      />
    </BrumeProvider>,
  );
  return { onMove };
}

function Controlled({ onCollapsedChange }: { onCollapsedChange(next: Set<string>): void }) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set(['b']));
  return (
    <SortableTree<Item>
      nodes={NODES}
      enabled
      nodeLabel={(n) => n.name}
      renderNode={(n) => <span data-testid={`node-${n.id}`}>{n.name}</span>}
      onMove={() => {}}
      collapsed={collapsed}
      onCollapsedChange={(next) => {
        onCollapsedChange(next);
        setCollapsed(next);
      }}
    />
  );
}

const handle = (name: string) => screen.getByRole('button', { name: `拖曳排序：${name}` });
const items = () => screen.getAllByRole('listitem');
// dnd-kit keeps its own live region for pointer drags; read every polite announcement.
const status = () => ({
  textContent: screen
    .getAllByRole('status')
    .map((s) => s.textContent)
    .join(' '),
});

describe('SortableTree', () => {
  it('renders nodes with depth indentation', () => {
    mount({
      nodes: [...NODES.slice(0, 2), { id: 'a11', parent: 'a1', name: 'T恤' }, ...NODES.slice(2)],
    });
    const rows = items();
    expect(rows.map((r) => r.getAttribute('aria-level'))).toEqual(['1', '2', '3', '1', '2']);
    expect(screen.getByTestId('node-a1').textContent).toBe('上衣（2）');
    // Cards step in by 1.25rem per level (the TreeLabel step); the elbow sits in that gutter.
    const indent = (r: Element) => (r as HTMLElement).style.paddingInlineStart;
    expect(rows.map(indent)).toEqual(['0rem', '0rem', '1.25rem', '0rem', '0rem']);
    const elbow = (r: Element | undefined) => r?.querySelector('[data-tree-elbow]') ?? null;
    expect(elbow(rows[0])).toBeNull();
    expect(elbow(rows[1])).not.toBeNull();
    expect(elbow(rows[2])).not.toBeNull();
    expect(rows[0]?.getAttribute('aria-setsize')).toBe('2');
    expect(rows[3]?.getAttribute('aria-posinset')).toBe('2');
  });

  it('keyboard right arrow nests under the previous sibling and reports parent', async () => {
    const user = userEvent.setup();
    const { onMove } = mount();
    handle('家居').focus();
    await user.keyboard(' ');
    expect(status().textContent).toContain('已拿起 家居');
    await user.keyboard('{ArrowRight}');
    expect(status().textContent).toContain('家居 移到 服飾 底下');
    // Previewed in place, focus stays on the handle; the subtree is tucked away while carried.
    expect(items().map((r) => r.getAttribute('aria-level'))).toEqual(['1', '2', '2']);
    expect(document.activeElement).toBe(handle('家居'));
    expect(onMove).not.toHaveBeenCalled();
    await user.keyboard(' ');
    expect(onMove).toHaveBeenCalledWith({ id: 'b', parent: 'a', after: 'a1' });
  });

  it('keyboard left arrow outdents to right after the parent', async () => {
    const user = userEvent.setup();
    const { onMove } = mount();
    handle('上衣').focus();
    await user.keyboard('{Enter}{ArrowLeft}{Enter}');
    expect(onMove).toHaveBeenCalledWith({ id: 'a1', parent: null, after: 'a' });
  });

  it('escape cancels and restores the order; an unchanged drop reports nothing', async () => {
    const user = userEvent.setup();
    const { onMove } = mount();
    handle('家居').focus();
    await user.keyboard(' {ArrowUp}');
    await user.keyboard('{Escape}');
    expect(status().textContent).toContain('已取消');
    expect(items().map((r) => r.textContent)).toEqual([
      expect.stringContaining('服飾'),
      expect.stringContaining('上衣'),
      expect.stringContaining('家居'),
      expect.stringContaining('寢具'),
    ]);
    await user.keyboard('{Enter}{Enter}');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('collapse hides children', async () => {
    const user = userEvent.setup();
    mount();
    const toggle = screen.getByRole('button', { name: '服飾 的子項目' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('node-a1')).toBeNull();
    expect(screen.getByTestId('node-b1')).toBeTruthy();
    // Leaves get no toggle.
    expect(screen.queryByRole('button', { name: '上衣 的子項目' })).toBeNull();
    await user.click(toggle);
    expect(screen.getByTestId('node-a1')).toBeTruthy();
  });

  it('controlled collapse follows the collapsed prop', async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();
    render(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <Controlled onCollapsedChange={onCollapsedChange} />
      </BrumeProvider>,
    );
    expect(screen.queryByTestId('node-b1')).toBeNull();
    await user.click(screen.getByRole('button', { name: '家居 的子項目' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(new Set());
    expect(screen.getByTestId('node-b1')).toBeTruthy();
  });

  it('illegal keyboard nesting beyond maxDepth is announced and ignored', async () => {
    const user = userEvent.setup();
    const { onMove } = mount({ maxDepth: 2 });
    handle('家居').focus();
    await user.keyboard(' {ArrowRight}');
    expect(status().textContent).toContain('最多 2 層');
    expect(items().map((r) => r.getAttribute('aria-level'))).toEqual(['1', '2', '1']);
    await user.keyboard(' ');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('enabled false disables the handles but keeps the tree collapsible', async () => {
    const user = userEvent.setup();
    const { onMove } = mount({ enabled: false });
    const h = handle('家居');
    expect(h.getAttribute('aria-disabled')).toBe('true');
    h.focus();
    await user.keyboard(' {ArrowRight} ');
    expect(onMove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '服飾 的子項目' }));
    expect(screen.queryByTestId('node-a1')).toBeNull();
  });

  it('renders as a list', () => {
    mount();
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
  });
});
