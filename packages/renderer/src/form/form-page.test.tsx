import { ConfirmHost, type HttpResponse } from '@brume-ui/brume-react';
import type { FormPage } from '@brume-ui/brume-schema';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BrumePageView } from '../render-page';
import { renderWithBrume } from '../test-utils';
import { FormPageView } from './form-page';

const page: FormPage = {
  type: 'form',
  title: 'Edit item',
  name: 'Item',
  formId: 'items',
  mode: 'edit',
  presentation: 'page',
  size: 'md',
  listUrl: '/items',
  values: { name: 'old' },
  submit: { method: 'put', url: '/items/1', label: 'Save' },
  after: { options: ['edit', 'list'], default: 'edit' },
  form: {
    layout: 'stacked',
    sections: 'tabs',
    nodes: [1, 2, 3].map((n) => ({
      type: 'section',
      key: `s${n}`,
      title: `Section ${n}`,
      children:
        n === 2
          ? [
              {
                type: 'field',
                field: {
                  type: 'text',
                  name: 'name',
                  label: 'Name',
                  rules: [{ rule: 'required', message: 'Required' }],
                },
              },
            ]
          : [],
    })),
  },
};
it('stacks sections, marks section errors, and focuses its heading', async () => {
  renderWithBrume(<FormPageView page={page} />);
  expect(screen.queryByRole('tab')).toBeNull();
  const link = screen.getByRole('link', { name: 'Section 2' });
  fireEvent.click(link);
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Section 2' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Section 2（有錯誤）' })).toBeTruthy(),
  );
});
it('sidebar link with unsaved changes asks first and cancellation keeps the guard', async () => {
  const { adapter } = renderWithBrume(
    <>
      <ConfirmHost />
      <FormPageView page={page} />
    </>,
  );
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'changed' } });
  act(() => adapter.visit('/admin'));
  await screen.findByRole('alertdialog');
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  act(() => adapter.visit('/admin'));
  await screen.findByRole('alertdialog');
  fireEvent.click(screen.getByRole('button', { name: '放棄變更' }));
  await waitFor(() => expect(adapter.currentUrl()).toBe('/admin'));
});
it('discards only after confirmation and restores initial values', async () => {
  renderWithBrume(
    <>
      <ConfirmHost />
      <FormPageView page={page} />
    </>,
  );
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'changed' } });
  expect(screen.getByText('● 有未儲存的變更')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '捨棄變更' }));
  await screen.findByRole('alertdialog');
  fireEvent.click(screen.getByRole('button', { name: '放棄變更' }));
  await waitFor(() =>
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('old'),
  );
});
it.each([undefined, '/priority'])(
  'successful edit redirects without prompting, feedback %s',
  async (redirect) => {
    const { adapter } = renderWithBrume(
      <>
        <ConfirmHost />
        <FormPageView page={page} />
      </>,
      {
        respond: () => ({
          status: 200,
          data: { id: 1, urls: { edit: '/items/1/edit' }, feedback: { redirect } },
        }),
      },
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adapter.currentUrl()).toBe(redirect ?? '/items/1/edit'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  },
);
it('keeps values on same record rerender and ignores IME shortcuts', () => {
  const respond = vi.fn();
  const { rerender } = renderWithBrume(<FormPageView page={page} />, { respond });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'changed' } });
  rerender(<FormPageView page={{ ...page, values: { name: 'server' } }} />);
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('changed');
  fireEvent.keyDown(document, { key: 'Enter', metaKey: true, isComposing: true });
  expect(respond).not.toHaveBeenCalled();
});
it('dispatches form envelopes', () => {
  renderWithBrume(<BrumePageView envelope={{ schemaVersion: '0.3.0', page }} />);
  expect(screen.getByLabelText('Name')).toBeTruthy();
});
it('clean navigation and partial reload bypass confirmation; dirty unload uses the native prompt', () => {
  const { adapter } = renderWithBrume(<FormPageView page={page} />);
  act(() => adapter.visit('/clean'));
  expect(adapter.currentUrl()).toBe('/clean');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'changed' } });
  act(() => adapter.visit('/clean', { only: ['page'] }));
  expect(adapter.calls.filter((call) => call.fn === 'visit')).toHaveLength(2);
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
it('tracks visible sections using IntersectionObserver', () => {
  let notify!: IntersectionObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  try {
    const { unmount } = renderWithBrume(<FormPageView page={page} />);
    const heading = screen.getByRole('heading', { name: 'Section 3' });
    act(() =>
      notify(
        [
          {
            target: heading,
            isIntersecting: true,
            boundingClientRect: { top: 20 },
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    );
    expect(screen.getByRole('link', { name: 'Section 3' }).getAttribute('aria-current')).toBe(
      'true',
    );
    unmount();
    expect(disconnect).toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
it('rejects unsafe feedback redirects and ignores late success after changing records', async () => {
  let finish!: (value: HttpResponse) => void;
  const { adapter, rerender } = renderWithBrume(<FormPageView page={page} />, {
    respond: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  rerender(
    <FormPageView
      page={{ ...page, submit: { ...page.submit, url: '/items/2' }, values: { name: 'second' } }}
    />,
  );
  await act(async () => finish({ status: 200, data: { id: 1, urls: { edit: '/stale' } } }));
  expect(adapter.calls.some((call) => call.fn === 'visit')).toBe(false);
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('second');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await act(async () =>
    finish({
      status: 200,
      data: { id: 2, urls: { edit: '/safe' }, feedback: { redirect: 'javascript:alert(1)' } },
    }),
  );
  expect(adapter.calls.some((call) => call.fn === 'visit')).toBe(false);
});
it('global shortcut saves once while the request is pending', async () => {
  let finish!: (value: HttpResponse) => void;
  const respond = vi.fn(
    () =>
      new Promise<HttpResponse>((resolve) => {
        finish = resolve;
      }),
  );
  renderWithBrume(<FormPageView page={page} />, { respond });
  act(() => {
    fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
  });
  expect(respond).toHaveBeenCalledTimes(1);
  await act(async () => finish({ status: 200, data: { cancelled: true } }));
});
it.each(['list', 'create', 'view'] as const)(
  'redirects after %s, including listUrl fallback',
  async (after) => {
    const { adapter } = renderWithBrume(
      <FormPageView page={{ ...page, after: { default: after, options: [after] } }} />,
      {
        respond: () => ({ status: 200, data: { id: 1, urls: { create: '/new', view: '/show' } } }),
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(adapter.currentUrl()).toBe(
        after === 'list' ? '/items' : after === 'create' ? '/new' : '/show',
      ),
    );
  },
);
it('deduplicates blocked visits while confirming and ignores confirmation after unmount', async () => {
  const { adapter, rerender } = renderWithBrume(
    <>
      <ConfirmHost />
      <FormPageView page={page} />
    </>,
  );
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'changed' } });
  act(() => {
    adapter.visit('/first');
    adapter.visit('/second');
  });
  await screen.findByRole('alertdialog');
  rerender(<ConfirmHost />);
  fireEvent.click(screen.getByRole('button', { name: '放棄變更' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(adapter.calls.filter((call) => call.fn === 'visit')).toHaveLength(0);
});
