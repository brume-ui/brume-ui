import type { PickerSearchResponse, RelationItem } from '@brume-ui/brume-schema';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { RelationPicker } from './relation-picker';

it('keeps ordered draft extras across pages and sections, cancels without publishing, and returns focus', () => {
  const change = vi.fn();
  // biome-ignore lint/correctness/noComponentHookFactories: this test mounts one stable harness instance.
  function Harness() {
    const [value, setValue] = useState<RelationItem[]>([{ id: 'a', quantity: '2' }]);
    const [page, setPage] = useState(1);
    const [section, setSection] = useState('all');
    const items: PickerSearchResponse['data'] =
      page === 1
        ? [
            { value: 'a', label: 'Apple' },
            { value: 'blocked', label: 'Blocked', disabled: true },
          ]
        : [{ value: 'b', label: 'Banana' }];
    return (
      <BrumeProvider adapter={createMemoryAdapter()} locale="en">
        <RelationPicker
          label="Products"
          value={value}
          onChange={(next) => {
            change(next);
            setValue(next);
          }}
          multiple
          items={items}
          pagination={{ page, perPage: 2, hasMore: page === 1 }}
          loading={false}
          query=""
          section={section}
          sections={[
            { key: 'all', label: 'All' },
            { key: 'fruit', label: 'Fruit' },
          ]}
          onQueryChange={() => {}}
          onPageChange={setPage}
          onSectionChange={setSection}
          onRetry={() => {}}
          renderSelection={(item, _, update) => (
            <input
              aria-label={`Quantity ${item.id}`}
              value={String(item.quantity ?? '')}
              onChange={(event) => update({ ...item, quantity: event.target.value })}
            />
          )}
        />
      </BrumeProvider>
    );
  }
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: /Products/ });
  fireEvent.click(trigger);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Select Apple' }), { key: 'Enter' }),
  ).toBe(false);
  expect(
    (screen.getByRole('checkbox', { name: 'Select Blocked' }) as HTMLInputElement).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Quantity a'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Banana' }));
  fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'fruit' } });
  expect(screen.getByLabelText('Quantity a')).toHaveProperty('value', '7');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(change).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  expect(screen.getByLabelText('Quantity a')).toHaveProperty('value', '2');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Banana' }));
  fireEvent.change(screen.getByLabelText('Quantity b'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(change).toHaveBeenCalledExactlyOnceWith([
    { id: 'a', quantity: '2' },
    { id: 'b', quantity: '3' },
  ]);
});

it('Escape cancels only the inline draft inside a Dialog and Enter never submits its outer form', async () => {
  const { Dialog } = await import('./dialog');
  const close = vi.fn();
  const submit = vi.fn();
  render(
    <BrumeProvider adapter={createMemoryAdapter()} locale="en">
      <Dialog open title="Edit order" description="Order details" onOpenChange={close}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <RelationPicker
            label="Products"
            value={[]}
            onChange={() => {}}
            multiple
            items={[]}
            pagination={{ page: 1, perPage: 20, hasMore: false }}
            query=""
            loading={false}
            onQueryChange={() => {}}
            onPageChange={() => {}}
            onSectionChange={() => {}}
            onRetry={() => {}}
          />
          <button type="submit">Save order</button>
        </form>
      </Dialog>
    </BrumeProvider>,
  );
  const trigger = screen.getByRole('button', { name: /Products/ });
  fireEvent.click(trigger);
  const search = screen.getByRole('textbox', { name: 'Search' });
  fireEvent.keyDown(search, { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox', { name: 'Search' })).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  fireEvent.click(trigger);
  expect(fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'Enter' })).toBe(
    false,
  );
  expect(submit).not.toHaveBeenCalled();
});

it('does not let a removed selection callback restore extras after the same ID is selected again', () => {
  let updateOld!: (item: RelationItem) => void;
  const change = vi.fn();
  render(
    <BrumeProvider adapter={createMemoryAdapter()} locale="en">
      <RelationPicker
        label="Products"
        value={[{ id: 'a', quantity: 'old' }]}
        onChange={change}
        multiple
        items={[{ value: 'a', label: 'Apple' }]}
        pagination={{ page: 1, perPage: 20, hasMore: false }}
        query=""
        loading={false}
        onQueryChange={() => {}}
        onPageChange={() => {}}
        onSectionChange={() => {}}
        onRetry={() => {}}
        renderSelection={(item, _, update) => {
          if (item.quantity === 'old') updateOld = update;
          return null;
        }}
      />
    </BrumeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove “Apple”' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Apple' }));
  act(() => updateOld({ id: 'a', quantity: 'late' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(change).toHaveBeenCalledWith([{ id: 'a' }]);
});

it('shows hydrated committed labels separately from the search page and never copies display columns to writable values', () => {
  const change = vi.fn();
  render(
    <BrumeProvider adapter={createMemoryAdapter()} locale="en">
      <RelationPicker
        label="Products"
        value={[{ id: 'a', quantity: 2 }]}
        onChange={change}
        multiple
        items={[{ value: 'b', label: 'Banana', columns: { secret: '<b>display</b>' } }]}
        selectedOptions={[{ value: 'a', label: 'Apple' }]}
        columns={[{ key: 'secret', label: 'Display' }]}
        pagination={{ page: 2, perPage: 20, hasMore: false }}
        query=""
        loading={false}
        onQueryChange={() => {}}
        onPageChange={() => {}}
        onSectionChange={() => {}}
        onRetry={() => {}}
      />
    </BrumeProvider>,
  );
  expect(screen.getByText('Apple')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  expect(screen.queryByRole('checkbox', { name: 'Select Apple' })).toBeNull();
  expect(screen.getByText('<b>display</b>').tagName).toBe('TD');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Banana' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(change).toHaveBeenCalledWith([{ id: 'a', quantity: 2 }, { id: 'b' }]);
});

it('Escape cancels a column-filter picker without dismissing its existing Popover', async () => {
  const { Popover } = await import('./popover');
  const close = vi.fn();
  render(
    <BrumeProvider adapter={createMemoryAdapter()} locale="en">
      <Popover
        open
        title="Filter products"
        onOpenChange={close}
        trigger={<button type="button">Filter</button>}
      >
        <RelationPicker
          label="Products"
          value={[]}
          onChange={() => {}}
          multiple
          items={[]}
          pagination={{ page: 1, perPage: 20, hasMore: false }}
          query=""
          loading={false}
          onQueryChange={() => {}}
          onPageChange={() => {}}
          onSectionChange={() => {}}
          onRetry={() => {}}
        />
      </Popover>
    </BrumeProvider>,
  );
  const trigger = screen.getByRole('button', { name: /Products/ });
  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
});

it('scopes live draft readers to selection ownership and the open session before React commits', () => {
  let read!: () => readonly RelationItem[];
  render(
    <BrumeProvider adapter={createMemoryAdapter()} locale="en">
      <RelationPicker
        label="Products"
        value={[{ id: 'a' }]}
        onChange={() => {}}
        multiple
        items={[{ value: 'a', label: 'Apple' }]}
        pagination={{ page: 1, perPage: 20, hasMore: false }}
        query=""
        loading={false}
        onQueryChange={() => {}}
        onPageChange={() => {}}
        onSectionChange={() => {}}
        onRetry={() => {}}
        renderSelection={(_item, _index, _update, _draft, getDraft) => {
          read = getDraft;
          return null;
        }}
      />
    </BrumeProvider>,
  );
  const trigger = screen.getByRole('button', { name: /Products/ });
  fireEvent.click(trigger);
  const removedRead = read;
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Remove “Apple”' }));
    expect(removedRead()).toEqual([]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Apple' }));
    expect(removedRead()).toEqual([]);
  });
  const previousSession = read;
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(trigger);
    expect(previousSession()).toEqual([]);
  });
  expect(read()).toEqual([{ id: 'a' }]);
});

it('commits the current synchronous draft and single mode never emits more than one entry', () => {
  const change = vi.fn();
  let edit!: (item: RelationItem) => void;
  render(
    <BrumeProvider adapter={createMemoryAdapter()} locale="en">
      <RelationPicker
        label="Product"
        value={[{ id: 'a', quantity: '2' }]}
        onChange={change}
        multiple={false}
        items={[
          { value: 'a', label: 'Apple' },
          { value: 'b', label: 'Banana' },
        ]}
        pagination={{ page: 1, perPage: 20, hasMore: false }}
        query=""
        loading={false}
        onQueryChange={() => {}}
        onPageChange={() => {}}
        onSectionChange={() => {}}
        onRetry={() => {}}
        renderSelection={(_item, _index, update) => {
          edit = update;
          return null;
        }}
      />
    </BrumeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Product/ }));
  fireEvent.click(screen.getByRole('radio', { name: 'Select Banana' }));
  act(() => {
    edit({ id: 'b', quantity: '8' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  });
  expect(change).toHaveBeenCalledWith([{ id: 'b', quantity: '8' }]);
});
