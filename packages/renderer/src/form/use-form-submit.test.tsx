import { type HttpResponse, toast } from '@brume-ui/brume-react';
import type { FormPage } from '@brume-ui/brume-schema';
import { act, screen } from '@testing-library/react';
import { useRef } from 'react';
import { expect, it, vi } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { FormView, type FormViewHandle } from './form-view';
import { type FormApi, useFormState } from './use-form-state';
import { useFormSubmit } from './use-form-submit';

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
function Harness({
  onState,
  formPage = page,
}: {
  formPage?: FormPage;
  onState(api: FormApi, submit: ReturnType<typeof useFormSubmit>['submit']): void;
}) {
  const api = useFormState(formPage.form, formPage.values);
  const ref = useRef<FormViewHandle>(null);
  const { submit } = useFormSubmit(formPage, api, ref);
  onState(api, submit);
  return <FormView ref={ref} form={formPage.form} api={api} />;
}
function setup(respond: NonNullable<Parameters<typeof renderWithBrume>[1]>['respond']) {
  let api!: FormApi;
  let submit!: ReturnType<typeof useFormSubmit>['submit'];
  const rendered = renderWithBrume(
    <Harness
      onState={(next, send) => {
        api = next;
        submit = send;
      }}
    />,
    { respond },
  );
  return {
    ...rendered,
    api: () => api,
    submit: (after: 'edit' | 'list' = 'edit') => submit(after),
  };
}
it('blocks a pending upload immediately before React has rendered it', async () => {
  const respond = vi.fn();
  const info = vi.spyOn(toast, 'info');
  const s = setup(respond);
  await act(async () => {
    const finish = s.api().trackUpload();
    await s.submit();
    finish();
  });
  expect(respond).not.toHaveBeenCalled();
  expect(info).toHaveBeenCalledWith('檔案還在上傳，完成後才能儲存。');
  info.mockRestore();
});
it('focuses nested 422 fields and keeps unknown errors in the summary', async () => {
  const s = setup(() => ({
    status: 422,
    data: { message: 'Invalid', errors: { name: ['Wrong'], total: ['Total wrong'] } },
  }));
  await act(async () => {
    await s.submit();
  });
  expect(s.api().errors).toEqual({ name: ['Wrong'], total: ['Total wrong'] });
  expect(document.activeElement).toBe(screen.getByLabelText('Name'));
});
it('ignores a response after an explicit reset, including identical values', async () => {
  let finish!: (response: HttpResponse) => void;
  const s = setup(
    () =>
      new Promise<HttpResponse>((resolve) => {
        finish = resolve;
      }),
  );
  let request!: Promise<unknown>;
  act(() => {
    request = s.submit();
  });
  act(() => s.api().reset({ name: 'replacement' }));
  await act(async () => {
    finish({ status: 200, data: { id: 1, urls: { edit: '/1' } } });
    expect(await request).toBeNull();
  });
  expect(s.api().values).toEqual({ name: 'replacement' });
});
it('does not erase a programmatic edit made while the request is pending', async () => {
  let finish!: (response: HttpResponse) => void;
  const s = setup(
    () =>
      new Promise<HttpResponse>((resolve) => {
        finish = resolve;
      }),
  );
  let request!: Promise<unknown>;
  act(() => {
    request = s.submit();
  });
  act(() => s.api().setValue('name', 'newer'));
  await act(async () => {
    finish({ status: 200, data: { id: 1, urls: { edit: '/1' } } });
    expect(await request).toBeNull();
  });
  expect(s.api().values).toEqual({ name: 'newer' });
  expect(s.api().dirty).toBe(true);
});
it('applies safe cancellation redirects only, without resetting', async () => {
  const s = setup(() => ({
    status: 200,
    data: { cancelled: true, feedback: { redirect: '/cancelled' } },
  }));
  act(() => s.api().setValue('name', 'changed'));
  await act(async () => expect(await s.submit()).toBeNull());
  expect(s.api().dirty).toBe(true);
  expect(s.adapter.currentUrl()).toBe('/cancelled');
});
it('rejects unsafe cancellation redirects and reports request failures', async () => {
  const error = vi.spyOn(toast, 'error');
  let response: HttpResponse = {
    status: 200,
    data: { cancelled: true, feedback: { redirect: 'javascript:alert(1)' } },
  };
  const s = setup(() => response);
  await act(async () => expect(await s.submit()).toBeNull());
  expect(s.adapter.calls.filter((call) => call.fn === 'visit')).toHaveLength(0);
  response = { status: 419, data: { message: 'Expired' } };
  await act(async () => expect(await s.submit()).toBeNull());
  expect(error).toHaveBeenCalled();
  expect(s.api().submitting).toBe(false);
  error.mockRestore();
});
it('observes submitting synchronously and ignores a second direct submit', async () => {
  let finish!: (response: HttpResponse) => void;
  const respond = vi.fn(
    () =>
      new Promise<HttpResponse>((resolve) => {
        finish = resolve;
      }),
  );
  const s = setup(respond);
  let first!: Promise<unknown>;
  act(() => {
    first = s.submit();
    expect(s.api().submitting).toBe(true);
    void s.submit();
  });
  expect(respond).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish({ status: 200, data: { id: 1, urls: { edit: '/1' } } });
    await first;
  });
  expect(s.api().submitting).toBe(false);
});
it('does not clear submitting state belonging to an explicit reset generation', async () => {
  let finish!: (response: HttpResponse) => void;
  const s = setup(
    () =>
      new Promise<HttpResponse>((resolve) => {
        finish = resolve;
      }),
  );
  let request!: Promise<unknown>;
  act(() => {
    request = s.submit();
  });
  act(() => {
    s.api().reset({ name: 'replacement' });
    s.api().setSubmitting(true);
  });
  await act(async () => {
    finish({ status: 200, data: { id: 1, urls: { edit: '/stale' } } });
    expect(await request).toBeNull();
  });
  expect(s.api().values).toEqual({ name: 'replacement' });
  expect(s.api().submitting).toBe(true);
});
it('releases owned state even if a changed semantic page invalidates the response', async () => {
  let api!: FormApi;
  let submit!: ReturnType<typeof useFormSubmit>['submit'];
  const onState = (next: FormApi, send: typeof submit) => {
    api = next;
    submit = send;
  };
  let finish!: (response: HttpResponse) => void;
  const { rerender } = renderWithBrume(<Harness onState={onState} />, {
    respond: () =>
      new Promise<HttpResponse>((resolve) => {
        finish = resolve;
      }),
  });
  let request!: Promise<unknown>;
  act(() => {
    api.setValue('name', 'mine');
    request = submit('edit');
  });
  rerender(<Harness onState={onState} formPage={{ ...page, record: { id: 2 } }} />);
  await act(async () => {
    finish({ status: 200, data: { id: 1, urls: { edit: '/stale' } } });
    expect(await request).toBeNull();
  });
  expect(api.submitting).toBe(false);
  expect(api.values).toEqual({ name: 'mine' });
  expect(api.dirty).toBe(true);
});
