import { ConfirmHost, type HttpResponse } from '@brume-ui/brume-react';
import type { FormPage } from '@brume-ui/brume-schema';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { FormDialog } from './form-dialog';

const page: FormPage = {
  type: 'form',
  title: 'Edit',
  name: 'Item',
  formId: 'items',
  mode: 'edit',
  form: {
    layout: 'stacked',
    nodes: [{ type: 'field', field: { type: 'text', name: 'name', label: 'Name' } }],
  },
  values: { name: 'old' },
  submit: { method: 'put', url: '/items/1', label: 'Save' },
  after: { options: ['edit', 'list'], default: 'edit' },
  presentation: 'modal',
  size: 'md',
};
it('locks synchronous double submit, retains dirty on cancellation, and never calls onSaved', async () => {
  let finish!: (res: HttpResponse) => void;
  const respond = vi.fn(
    () =>
      new Promise<HttpResponse>((resolve) => {
        finish = resolve;
      }),
  );
  const onSaved = vi.fn();
  renderWithBrume(
    <>
      <ConfirmHost />
      <FormDialog page={page} open onOpenChange={() => {}} onSaved={onSaved} />
    </>,
    { respond },
  );
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'changed' } });
  const input = screen.getByLabelText('Name');
  act(() => {
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
  });
  expect(respond).toHaveBeenCalledTimes(1);
  await act(async () =>
    finish({
      status: 200,
      data: { cancelled: true, feedback: { toast: { type: 'info', message: 'Stopped' } } },
    }),
  );
  expect(onSaved).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('changed');
  fireEvent.keyDown(input, { key: 'Escape' });
  await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: '放棄變更' }));
});
it('ignores IME save and focuses errors after validation renders', async () => {
  const respond = vi.fn();
  const required = {
    ...page,
    values: { name: '' },
    form: {
      ...page.form,
      nodes: [
        {
          type: 'field' as const,
          field: {
            type: 'text' as const,
            name: 'name',
            label: 'Name',
            rules: [{ rule: 'required' as const, message: 'Required' }],
          },
        },
      ],
    },
  };
  renderWithBrume(<FormDialog page={required} open onOpenChange={() => {}} onSaved={() => {}} />, {
    respond,
  });
  fireEvent.keyDown(screen.getByLabelText('Name'), {
    key: 'Enter',
    metaKey: true,
    isComposing: true,
  });
  expect(respond).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getAllByText('Required')[0]).toBeTruthy());
  expect(document.activeElement).toBe(screen.getByLabelText('Name'));
  expect(respond).not.toHaveBeenCalled();
});
it('successful saving resets dirty before onSaved and later Escape closes directly', async () => {
  const onSaved = vi.fn(),
    onOpenChange = vi.fn();
  renderWithBrume(<FormDialog page={page} open onOpenChange={onOpenChange} onSaved={onSaved} />, {
    respond: () => ({ status: 200, data: { id: 1, urls: { edit: '/items/1' } } }),
  });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'saved' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(onSaved).toHaveBeenCalledWith({ id: 1, urls: { edit: '/items/1' } }, 'edit'),
  );
  fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
it('reenables fields before focusing a 422 field and shows unclaimed errors', async () => {
  renderWithBrume(<FormDialog page={page} open onOpenChange={() => {}} onSaved={() => {}} />, {
    respond: () => ({
      status: 422,
      data: { message: 'Invalid', errors: { name: ['Name wrong'], total: ['Total wrong'] } },
    }),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Name')));
  expect(screen.getByText('Total wrong')).toBeTruthy();
});
it('respects editable arrow keys and confirms dirty Alt navigation from the footer', async () => {
  const prev = vi.fn();
  renderWithBrume(
    <>
      <ConfirmHost />
      <FormDialog page={page} open onOpenChange={() => {}} onSaved={() => {}} nav={{ prev }} />
    </>,
  );
  fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'ArrowUp' });
  expect(prev).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'dirty' } });
  fireEvent.keyDown(screen.getByRole('button', { name: 'Save' }), { key: 'ArrowUp', altKey: true });
  expect(prev).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: '放棄變更' }));
  await waitFor(() => expect(prev).toHaveBeenCalledTimes(1));
});
it('does not apply an old request to a newly loaded page, even for the same record', async () => {
  let finish!: (res: HttpResponse) => void;
  const onSaved = vi.fn();
  const result = renderWithBrume(
    <FormDialog page={page} open onOpenChange={() => {}} onSaved={onSaved} />,
    {
      respond: () =>
        new Promise<HttpResponse>((resolve) => {
          finish = resolve;
        }),
    },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  result.rerender(
    <FormDialog
      page={{ ...page, values: { name: 'reloaded' } }}
      open
      onOpenChange={() => {}}
      onSaved={onSaved}
    />,
  );
  await act(async () => finish({ status: 200, data: { id: 1, urls: { edit: '/items/1' } } }));
  expect(onSaved).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('reloaded');
});
it('focuses the summary for a server error without a declared field', async () => {
  renderWithBrume(<FormDialog page={page} open onOpenChange={() => {}} onSaved={() => {}} />, {
    respond: () => ({
      status: 422,
      data: { message: 'Invalid', errors: { total: ['Total wrong'] } },
    }),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('alert')));
});
it('persists the selected after-save choice and gives that choice to onSaved', async () => {
  const onSaved = vi.fn();
  const user = userEvent.setup();
  const result = renderWithBrume(
    <FormDialog page={page} open onOpenChange={() => {}} onSaved={onSaved} />,
    { respond: () => ({ status: 200, data: { id: 1, urls: { edit: '/items/1' } } }) },
  );
  await user.click(screen.getByRole('combobox', { name: '儲存後' }));
  await user.click(screen.getByRole('option', { name: '回到列表' }));
  expect(localStorage.getItem('brume.form.items.after')).toBe('list');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(onSaved).toHaveBeenCalledWith({ id: 1, urls: { edit: '/items/1' } }, 'list'),
  );
  result.rerender(<FormDialog page={null} open onOpenChange={() => {}} onSaved={onSaved} />);
  result.rerender(<FormDialog page={page} open onOpenChange={() => {}} onSaved={onSaved} />);
  expect(screen.getByRole('combobox', { name: '儲存後' }).textContent).toBe('回到列表');
  localStorage.removeItem('brume.form.items.after');
});

function NavigationHarness({ loadNext }: { loadNext?(): Promise<FormPage> }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<FormPage | null>(page);
  return (
    <>
      <ConfirmHost />
      <button
        type="button"
        onClick={() => {
          setCurrent(page);
          setOpen(true);
        }}
      >
        Open item
      </button>
      <FormDialog
        page={current}
        open={open}
        onOpenChange={setOpen}
        onSaved={() => setOpen(false)}
        nav={{
          next: () => {
            if (loadNext) {
              setCurrent(null);
              void loadNext().then(setCurrent);
              return;
            }
            setCurrent({
              ...page,
              record: { id: 2 },
              description: 'Record two',
              values: { name: 'second' },
            });
          },
        }}
      />
    </>
  );
}

it('restores the original opener after record replacement and dirty discard', async () => {
  const user = userEvent.setup();

  renderWithBrume(<NavigationHarness />, {
    respond: () => ({ status: 200, data: { id: 1, urls: { edit: '/items/1' } } }),
  });
  const opener = screen.getByRole('button', { name: 'Open item' });
  await user.click(opener);
  await user.type(screen.getByLabelText('Name'), ' first');
  await user.keyboard('{Meta>}{Enter}{/Meta}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(opener));
  await user.click(opener);
  await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
  await waitFor(() =>
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('second'),
  );
  await user.type(screen.getByLabelText('Name'), ' changed');
  await user.keyboard('{Escape}');
  await user.click(await screen.findByRole('button', { name: '放棄變更' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

it('restores the original opener after loading a different record', async () => {
  const user = userEvent.setup();
  let finish!: (next: FormPage) => void;
  renderWithBrume(
    <NavigationHarness
      loadNext={() =>
        new Promise((resolve) => {
          finish = resolve;
        })
      }
    />,
  );
  const opener = screen.getByRole('button', { name: 'Open item' });
  await user.click(opener);
  await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
  await screen.findByRole('dialog', { name: '載入中' });
  await act(async () => finish({ ...page, record: { id: 2 }, values: { name: 'loaded' } }));
  await waitFor(() =>
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('loaded'),
  );
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

it('restores the original opener when closed while the next record is loading', async () => {
  const user = userEvent.setup();
  renderWithBrume(<NavigationHarness loadNext={() => new Promise(() => {})} />);
  const opener = screen.getByRole('button', { name: 'Open item' });
  await user.click(opener);
  await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
  await screen.findByRole('dialog', { name: '載入中' });
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(opener));
});
