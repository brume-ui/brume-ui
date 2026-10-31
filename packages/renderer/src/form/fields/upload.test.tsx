import type { FieldDef } from '@brume-ui/brume-schema';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setup } from './test-utils';

const def = {
  type: 'upload',
  name: 'images',
  label: 'Images',
  kind: 'file',
  multiple: true,
  accept: [],
  maxSize: 1000,
  sortable: true,
} satisfies Extract<FieldDef, { type: 'upload' }>;
describe('upload fields', () => {
  it('shows a missing endpoint instead of a drop zone', () => {
    setup({ ...def });
    expect(screen.getByRole('alert').textContent).toContain('這個表單沒有上傳端點');
    expect(screen.queryByText('拖曳檔案到這裡，或點選上傳')).toBeNull();
  });
  it('preserves archived values when reordered and edits indexed extras', () => {
    const a = { path: 'a', url: '/a', extra: { link: '' } };
    const b = { path: 'b', url: '/b' };
    const { onChange } = setup(
      { ...def, extra: [{ type: 'url', name: 'link', label: 'Link' }] },
      {
        uploadUrl: '/upload',
        value: [a, b],
        path: 'images',
        errors: { '1': ['Bad file'], '1.extra.link': ['Bad link'] },
      },
    );
    expect(screen.getByText('Bad file')).toBeTruthy();
    expect(screen.getByText('Bad link')).toBeTruthy();
    fireEvent.change(screen.getAllByRole('textbox')[0] as HTMLElement, {
      target: { value: 'https://example.com' },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      { ...a, extra: { link: 'https://example.com' } },
      b,
    ]);
    fireEvent.click(screen.getByRole('button', { name: '上移 b' }));
    expect(onChange).toHaveBeenLastCalledWith([
      b,
      { ...a, extra: { link: 'https://example.com' } },
    ]);
  });
});

import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import { act } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import { useFormState } from '../use-form-state';
import { UploadField } from './upload';

function Harness({ initial = [], multiple = true }: { initial?: unknown; multiple?: boolean }) {
  const form = useFormState({ layout: 'stacked', nodes: [] }, {});
  const [value, setValue] = useState(initial);
  return (
    <>
      <UploadField
        def={{ ...def, multiple, extra: [{ type: 'url', name: 'link', label: 'Link' }] }}
        value={value}
        onChange={setValue}
        onBlur={() => {}}
        errors={{ '0.extra.link': ['First link error'] }}
        path="meta.cover"
        id="upload"
        invalid={false}
        readOnly={false}
        disabled={false}
        form={form}
        uploadUrl="/upload"
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
      <output data-testid="pending">{form.pendingUploads}</output>
      <button type="button" onClick={() => setValue([{ path: 'next', url: '/next' }])}>
        Next record
      </button>
    </>
  );
}
const success = {
  status: 200,
  data: { token: 'temp', name: 'file.txt', size: 1, mime: 'text/plain', expiresAt: 'tomorrow' },
};
const select = (container: HTMLElement) =>
  fireEvent.change(container.querySelector('input[type=file]') as HTMLInputElement, {
    target: { files: [new File(['a'], 'file.txt')] },
  });

it.each([true, false])('posts multipart and tracks the upload (multiple=%s)', async (multiple) => {
  let respond!: (value: HttpResponse) => void;
  const request = vi.fn(
    (_req: HttpRequest) =>
      new Promise<HttpResponse>((resolve) => {
        respond = resolve;
      }),
  );
  const { container } = renderWithBrume(
    <Harness initial={multiple ? [] : null} multiple={multiple} />,
    { respond: request },
  );
  select(container);
  expect(screen.getByTestId('pending').textContent).toBe('1');
  const req = request.mock.calls[0]?.[0] as unknown as {
    body: FormData;
    method: string;
    url: string;
    signal: AbortSignal;
  };
  expect(req.method).toBe('post');
  expect(req.url).toBe('/upload');
  expect(req.body.get('field')).toBe('meta.cover');
  expect(req.body.get('file')).toBeInstanceOf(File);
  expect(req.signal).toBeInstanceOf(AbortSignal);
  await act(async () => respond(success));
  expect(screen.getByTestId('pending').textContent).toBe('0');
  expect(JSON.parse(screen.getByTestId('value').textContent ?? 'null')).toEqual(
    multiple ? [{ token: 'temp' }] : { token: 'temp' },
  );
});

it('shows 422 upload errors while retaining archived values', async () => {
  const { container } = renderWithBrume(<Harness initial={[{ path: 'a', url: '/a' }]} />, {
    respond: () => ({ status: 422, data: { errors: { file: ['Rejected upload'] } } }),
  });
  select(container);
  await waitFor(() => expect(screen.getByText('Rejected upload')).toBeTruthy());
  expect(JSON.parse(screen.getByTestId('value').textContent ?? 'null')).toEqual([
    { path: 'a', url: '/a' },
  ]);
  expect(screen.getByTestId('pending').textContent).toBe('0');
});

it.each(['remove', 'record', 'unmount'])(
  'releases pending immediately on %s even if transport never settles, ignores stale completion',
  async (mode) => {
    let respond!: (value: HttpResponse) => void;
    const { container, unmount } = renderWithBrume(<Harness />, {
      respond: () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    });
    select(container);
    if (mode === 'remove') fireEvent.click(screen.getByRole('button', { name: '移除 file.txt' }));
    if (mode === 'record') fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
    if (mode === 'unmount') unmount();
    else expect(screen.getByTestId('pending').textContent).toBe('0');
    await act(async () => respond(success));
    if (mode !== 'unmount')
      expect(JSON.parse(screen.getByTestId('value').textContent ?? 'null')).toEqual(
        mode === 'record' ? [{ path: 'next', url: '/next' }] : [],
      );
  },
);

it('uses persisted indices for extras after an error row and preserves extras after upload', async () => {
  const { container } = renderWithBrume(<Harness />, { respond: () => success });
  fireEvent.change(container.querySelector('input[type=file]') as HTMLInputElement, {
    target: { files: [new File(['x'.repeat(1001)], 'large.txt')] },
  });
  select(container);
  await waitFor(() => expect(screen.getByRole('textbox')).toBeTruthy());
  expect(screen.getByText('First link error')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://example.com' } });
  expect(JSON.parse(screen.getByTestId('value').textContent ?? 'null')).toEqual([
    { token: 'temp', extra: { link: 'https://example.com' } },
  ]);
});

it('uses failureMessage for non-validation failures', async () => {
  const { container } = renderWithBrume(<Harness />, {
    respond: () => ({ status: 500, data: { message: 'Storage unavailable' } }),
  });
  select(container);
  await waitFor(() => expect(screen.getByText('操作沒有完成：Storage unavailable')).toBeTruthy());
  expect(screen.getByTestId('pending').textContent).toBe('0');
});
it('renders readOnly uploads as static values without needing an endpoint', () => {
  const { container } = setup(
    { ...def },
    { value: [{ path: 'stored', url: '/stored', name: 'Saved file' }], readOnly: true },
  );
  expect(screen.getByText('Saved file')).toBeTruthy();
  expect(container.querySelector('input[type=file]')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});
it('disables upload and remove controls and delegates blur', () => {
  const { container, onBlur } = setup(
    { ...def },
    { uploadUrl: '/upload', value: [{ path: 'a', url: '/a' }], disabled: true },
  );
  expect(
    Array.from(container.querySelectorAll('button,input')).every(
      (node) => (node as HTMLInputElement).disabled,
    ),
  ).toBe(true);
  fireEvent.blur(container.querySelector('input') as HTMLInputElement);
  expect(onBlur).toHaveBeenCalled();
});
it('scopes single-upload extras without an array index', () => {
  const { onChange } = setup(
    { ...def, multiple: false, extra: [{ type: 'url', name: 'link', label: 'Link' }] },
    {
      uploadUrl: '/upload',
      path: 'cover',
      value: { path: 'a', url: '/a' },
      errors: { 'extra.link': ['Single link error'] },
    },
  );
  expect(screen.getByText('Single link error')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://single.example' } });
  expect(onChange).toHaveBeenLastCalledWith({
    path: 'a',
    url: '/a',
    extra: { link: 'https://single.example' },
  });
});

function FormHarness({ initial }: { initial: unknown }) {
  const form = useFormState({ layout: 'stacked', nodes: [] }, { images: initial });
  return (
    <>
      <UploadField
        def={def}
        value={form.getValue('images')}
        onChange={(value) => form.setValue('images', value)}
        onBlur={() => form.touch('images')}
        errors={{}}
        path="images"
        id="real-upload"
        invalid={false}
        readOnly={false}
        disabled={false}
        form={form}
        uploadUrl="/upload"
      />
      <output data-testid="value">{JSON.stringify(form.getValue('images'))}</output>
      <output data-testid="pending">{form.pendingUploads}</output>
      <button type="button" onClick={() => form.setValue('other', true)}>
        Refresh form
      </button>
      <button type="button" onClick={() => form.reset()}>
        Reset form
      </button>
      <button
        type="button"
        onClick={() => form.reset({ images: [{ path: 'next', url: '/next' }] })}
      >
        Next record
      </button>
    </>
  );
}
it.each([{ initial: [] }, { initial: [{ path: 'a', url: '/a' }] }])(
  'keeps a pending upload through real form no-op writes ($initial)',
  async ({ initial }) => {
    let respond!: (response: HttpResponse) => void;
    let signal: AbortSignal | undefined;
    const { container } = renderWithBrume(<FormHarness initial={initial} />, {
      respond: (req) => {
        signal = req.signal;
        return new Promise((resolve) => {
          respond = resolve;
        });
      },
    });
    select(container);
    expect(screen.getByTestId('pending').textContent).toBe('1');
    expect(signal?.aborted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh form' }));
    expect(screen.getByText('file.txt')).toBeTruthy();
    await act(async () => respond(success));
    expect(JSON.parse(screen.getByTestId('value').textContent ?? 'null')).toEqual([
      ...(initial as unknown[]),
      { token: 'temp' },
    ]);
    expect(screen.getByTestId('pending').textContent).toBe('0');
  },
);
it('keeps a transient local error through an unrelated real form refresh', () => {
  const { container } = renderWithBrume(<FormHarness initial={[]} />);
  fireEvent.change(container.querySelector('input[type=file]') as HTMLInputElement, {
    target: { files: [new File(['x'.repeat(1001)], 'too-large.txt')] },
  });
  expect(screen.getByText('too-large.txt')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh form' }));
  expect(screen.getByText('too-large.txt')).toBeTruthy();
});
it.each(['Reset form', 'Next record'])(
  'cancels a real form upload on %s and ignores its eventual response',
  async (action) => {
    let respond!: (response: HttpResponse) => void;
    let signal: AbortSignal | undefined;
    const { container } = renderWithBrume(<FormHarness initial={[]} />, {
      respond: (req) => {
        signal = req.signal;
        return new Promise((resolve) => {
          respond = resolve;
        });
      },
    });
    select(container);
    expect(screen.getByTestId('pending').textContent).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(signal?.aborted).toBe(true);
    expect(screen.getByTestId('pending').textContent).toBe('0');
    await act(async () => respond(success));
    expect(JSON.parse(screen.getByTestId('value').textContent ?? 'null')).toEqual(
      action === 'Reset form' ? [] : [{ path: 'next', url: '/next' }],
    );
  },
);

it('uploads under a new picker with its declared ancestor source dependencies', async () => {
  const requests: HttpRequest[] = [];
  const { container } = renderWithBrume(<PickerUpload />, {
    respond: (request) => {
      requests.push(request);
      return success;
    },
  });
  select(container);
  await waitFor(() => expect(requests).toHaveLength(1));
  const body = requests[0]?.body as FormData;
  expect(JSON.parse(body.get('rowContext') as string)).toEqual([
    { path: 'products', key: '31', id: '31' },
  ]);
  expect(JSON.parse(body.get('ancestorSources') as string)).toEqual([
    { path: 'products', rowContext: [], depends: { tenant: 'scope-a' } },
  ]);
});

it('cancels pending nested uploads when an ancestor source dependency changes', async () => {
  let respond!: (response: HttpResponse) => void;
  let signal: AbortSignal | undefined;
  const { container } = renderWithBrume(<PickerUpload />, {
    respond: (request) => {
      signal = request.signal;
      return new Promise((resolve) => {
        respond = resolve;
      });
    },
  });
  select(container);
  expect(screen.getByTestId('pending').textContent).toBe('1');
  fireEvent.click(screen.getByRole('button', { name: 'Change tenant' }));
  expect(signal?.aborted).toBe(true);
  await act(async () => respond(success));
  expect(screen.getByTestId('picker-value').textContent).toBe('null');
  expect(screen.getByTestId('pending').textContent).toBe('0');
});

function PickerUpload() {
  const form = useFormState(
    {
      layout: 'stacked',
      nodes: [
        { type: 'field', field: { type: 'text', name: 'tenant', label: 'Tenant' } },
        {
          type: 'field',
          field: {
            type: 'relation',
            name: 'products',
            label: 'Products',
            multiple: true,
            remote: {
              url: '/options/products',
              dependsOn: { tenant: { scope: 'root', path: 'tenant' } },
            },
            fields: [{ type: 'field', field: { ...def, name: 'file', multiple: false } }],
          },
        },
      ],
    },
    { tenant: 'scope-a', products: [{ id: '31', file: null }] },
  );
  return (
    <>
      <UploadField
        def={{ ...def, name: 'file', multiple: false }}
        value={form.getValue('products.0.file')}
        onChange={(value) => form.setValue('products.0.file', value)}
        onBlur={() => {}}
        errors={{}}
        path="products.0.file"
        id="picker-upload"
        invalid={false}
        readOnly={false}
        disabled={false}
        form={form}
        uploadUrl="/upload"
        rowContext={form.getField('products.0.file')?.rowContext}
      />
      <button type="button" onClick={() => form.setValue('tenant', 'scope-b')}>
        Change tenant
      </button>
      <output data-testid="picker-value">{JSON.stringify(form.getValue('products.0.file'))}</output>
      <output data-testid="pending">{form.pendingUploads}</output>
    </>
  );
}
