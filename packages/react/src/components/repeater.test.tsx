import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { Repeater, type RepeaterProps, type RepeaterTableProps } from './repeater';

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

function TableHarness(props: Partial<RepeaterTableProps>) {
  const [rows, setRows] = useState([{ key: 'a' }, { key: 'b' }]);
  return (
    <BrumeProvider adapter={createMemoryAdapter()} locale="en">
      <Repeater
        label="Rows"
        layout="table"
        columns={[
          { key: 'name', label: 'Name', required: true },
          { key: 'qty', label: 'Qty' },
        ]}
        rows={rows}
        renderCell={(row, _index, column) => (
          <input aria-label={`${column} ${row.key}`} defaultValue={`${column}-${row.key}`} />
        )}
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
describe('Repeater layout="table"', () => {
  it('renders a real table with column headers, one row per item and cells from renderCell', () => {
    render(<TableHarness />);
    const table = screen.getByRole('table', { name: 'Rows' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers[0]?.getAttribute('scope')).toBe('col');
    expect(headers[0]?.textContent).toContain('Name');
    expect(headers[0]?.textContent).toContain('*');
    expect(headers[1]?.textContent).toBe('Qty');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2
    expect((screen.getByLabelText('qty b') as HTMLInputElement).value).toBe('qty-b');
    expect(screen.getAllByRole('cell')).toHaveLength(6);
  });
  it('states the table roles explicitly (display:block cards must not drop the semantics)', () => {
    render(<TableHarness />);
    const table = screen.getByRole('table', { name: 'Rows' });
    expect(table.getAttribute('role')).toBe('table');
    expect(table.querySelector('thead')?.getAttribute('role')).toBe('rowgroup');
    expect(table.querySelector('tbody')?.getAttribute('role')).toBe('rowgroup');
    for (const el of table.querySelectorAll('tr')) expect(el.getAttribute('role')).toBe('row');
    for (const el of table.querySelectorAll('th')) {
      expect(el.getAttribute('role')).toBe('columnheader');
    }
    for (const el of table.querySelectorAll('td')) expect(el.getAttribute('role')).toBe('cell');
  });
  it('keeps the same controls, names and focus rules as the stack layout', () => {
    render(<TableHarness />);
    const a = screen.getByLabelText('name a');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Rows 1' }), { key: 'ArrowDown' });
    expect(screen.getByLabelText('name a')).toBe(a);
    expect(screen.getAllByRole('row')[2]?.contains(a)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rows 1' }));
    expect(document.activeElement).toBe(screen.getAllByRole('row')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rows 1' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add Rows' }));
  });
  it('honors min/max, disabled and unsortable controls', () => {
    const { unmount } = render(<TableHarness min={2} max={2} />);
    expect((screen.getByRole('button', { name: 'Add Rows' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'Remove Rows 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Move up Rows 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    unmount();
    render(<TableHarness sortable={false} />);
    expect(screen.queryByRole('button', { name: 'Reorder Rows 1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move up Rows 1' })).toBeNull();
  });
  it('drag and drop reorders table rows', () => {
    render(<TableHarness />);
    const a = screen.getByLabelText('name a');
    const transfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(screen.getByRole('button', { name: 'Reorder Rows 1' }), {
      dataTransfer: transfer,
    });
    const target = screen.getAllByRole('row')[2] as HTMLElement;
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    expect(screen.getAllByRole('row')[2]?.contains(a)).toBe(true);
  });
  it('labels each cell visually in card mode without double announcing', () => {
    render(<TableHarness />);
    const labels = document.querySelectorAll('[data-repeater-cell-label]');
    expect(labels).toHaveLength(4);
    for (const label of labels) expect(label.getAttribute('aria-hidden')).toBe('true');
    const table = screen.getByRole('table');
    expect(table.className).toContain('@max-[640px]');
    expect(table.parentElement?.className).toContain('@container');
  });
  it('draws no card caption for a cell that renders null, and keeps its td', () => {
    render(
      <BrumeProvider adapter={createMemoryAdapter()} locale="en">
        <Repeater
          layout="table"
          label="Rows"
          rows={[{ key: 'k1' }]}
          columns={[
            { key: 'a', label: 'A' },
            { key: 'b', label: 'B' },
          ]}
          renderCell={(_row, _i, key) => (key === 'a' ? <input aria-label="a" /> : null)}
          onAdd={() => {}}
          onRemove={() => {}}
          onMove={() => {}}
        />
      </BrumeProvider>,
    );
    expect(document.querySelectorAll('[data-repeater-cell-label]')).toHaveLength(1);
    expect(document.querySelectorAll('tbody tr:first-child td')).toHaveLength(3);
  });
  it('leaves the stack layout untouched (no table)', () => {
    render(<Harness />);
    expect(screen.queryByRole('table')).toBeNull();
  });
});
