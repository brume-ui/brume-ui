import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { Repeater, type RepeaterProps } from './repeater';

function Harness(props: Partial<RepeaterProps>) {
  const [rows, setRows] = useState([{ key: 'a' }, { key: 'b' }]);
  return (
    <BrumeProvider adapter={createMemoryAdapter()} locale="en">
      <Repeater
        label="Rows"
        rows={rows}
        renderRow={(row) => <input aria-label={row.key} defaultValue={row.key} />}
        onAdd={() => setRows([...rows, { key: 'new' }])}
        onMove={(from, to) => {
          const next = [...rows];
          const removed = next.splice(from, 1)[0];
          if (removed) next.splice(to, 0, removed);
          setRows(next);
          props.onMove?.(from, to);
        }}
        onRemove={(index) => setRows(rows.filter((_, i) => i !== index))}
        {...props}
      />
    </BrumeProvider>
  );
}
describe('Repeater', () => {
  it('keyboard and pointer reorder preserve mounted row inputs and move semantics', () => {
    render(<Harness />);
    const a = screen.getByLabelText('a');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Rows 1' }), { key: 'ArrowDown' });
    expect(screen.getByLabelText('a')).toBe(a);
    expect(screen.getAllByRole('listitem')[1]?.contains(a)).toBe(true);
    const transfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(screen.getByRole('button', { name: 'Reorder Rows 2' }), {
      dataTransfer: transfer,
    });
    fireEvent.dragOver(screen.getAllByRole('listitem')[0] as HTMLElement);
    fireEvent.drop(screen.getAllByRole('listitem')[0] as HTMLElement);
    expect(screen.getAllByRole('listitem')[0]?.contains(a)).toBe(true);
    expect(screen.getByLabelText('a')).toBe(a);
  });
  it('removal focuses nearest surviving row, then add when empty', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rows 1' }));
    expect(document.activeElement).toBe(screen.getByRole('listitem'));
    expect(within(screen.getByRole('listitem')).getByLabelText('b')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rows 1' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add Rows' }));
  });
  it('honors min/max, disabled and unsortable controls', () => {
    const { rerender } = render(<Harness min={2} max={2} />);
    expect((screen.getByRole('button', { name: 'Add Rows' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'Remove Rows 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    rerender(<Harness disabled sortable={false} />);
    expect(screen.queryByRole('button', { name: 'Reorder Rows 1' })).toBeNull();
    expect(
      screen.getAllByRole('button').every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });
});

function NestedHarness() {
  const [rows, setRows] = useState([{ key: 'a' }, { key: 'b' }]);
  return (
    <BrumeProvider adapter={createMemoryAdapter()} locale="en">
      <Repeater
        label="Outer"
        rows={rows}
        onAdd={() => {}}
        onRemove={() => {}}
        onMove={(from, to) => {
          const next = [...rows];
          const moved = next.splice(from, 1)[0];
          if (moved) next.splice(to, 0, moved);
          setRows(next);
        }}
        renderRow={(row) => (
          <Repeater
            label={`Inner ${row.key}`}
            rows={[{ key: `child-${row.key}` }]}
            onAdd={() => {}}
            onRemove={() => {}}
            onMove={() => {}}
            renderRow={() => <span>{row.key}</span>}
          />
        )}
      />
    </BrumeProvider>
  );
}
it('lets an outer drag land over a nested row without a child drop swallowing it', () => {
  render(<NestedHarness />);
  fireEvent.dragStart(screen.getByRole('button', { name: 'Reorder Outer 1' }), {
    dataTransfer: { setData: vi.fn() },
  });
  const child = screen.getByText('b').closest('li') as HTMLLIElement;
  fireEvent.dragOver(child);
  fireEvent.drop(child);
  expect(
    screen.getByRole('list', { name: 'Outer' }).children[1]?.getAttribute('data-repeater-key'),
  ).toBe('a');
});
