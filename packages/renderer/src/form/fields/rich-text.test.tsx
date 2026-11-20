import type { HttpRequest } from '@brume-ui/brume-react';
import type { FieldDef, FormDef, RowContext } from '@brume-ui/brume-schema';
import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveField } from '../../index';
import { renderWithBrume } from '../../test-utils';
import type { FieldProps } from '../contract';
import { Nodes } from '../layout/nodes';
import { type FormApi, useFormState } from '../use-form-state';
import { validateValue } from '../validate';
import { setup } from './test-utils';

// Jodit cannot run in jsdom: the react components are replaced by probes exposing their props.
type EditorProps = Record<string, unknown> & {
  onChange(v: string | null): void;
  onBlur?(): void;
  upload?(f: File, s: AbortSignal): Promise<unknown>;
};
const seen = vi.hoisted(() => ({ editor: undefined as unknown, view: undefined as unknown }));
vi.mock('@brume-ui/brume-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@brume-ui/brume-react')>()),
  RichTextEditor: (props: unknown) => {
    seen.editor = props;
    return <div data-testid="editor" />;
  },
  RichTextView: (props: unknown) => {
    seen.view = props;
    return <div data-testid="view" />;
  },
}));
const editor = () => seen.editor as EditorProps;

const def = {
  type: 'richText',
  name: 'body',
  label: '內文',
} satisfies Extract<FieldDef, { type: 'richText' }>;
const withImages = { ...def, images: { accept: ['image/png'], maxSize: 1000 } } as FieldDef;

describe('richText field', () => {
  it('is registered', () => {
    expect(resolveField('richText')).toBeTruthy();
  });

  it('propagates html and null from the editor, and blur', () => {
    const { onChange, onBlur } = setup(def, { value: '<p>x</p>' });
    expect(editor().value).toBe('<p>x</p>');
    act(() => editor().onChange(null));
    expect(onChange).toHaveBeenLastCalledWith(null);
    act(() => editor().onChange('<p>y</p>'));
    expect(onChange).toHaveBeenLastCalledWith('<p>y</p>');
    act(() => editor().onBlur?.());
    expect(onBlur).toHaveBeenCalled();
  });

  it('forwards height, contentCss, placeholder, label and disabled', () => {
    setup({ ...def, height: 300, contentCss: ['/a.css'], placeholder: '寫點什麼' } as FieldDef, {
      disabled: true,
    });
    expect(editor()).toMatchObject({
      height: 300,
      contentCss: ['/a.css'],
      placeholder: '寫點什麼',
      label: '內文',
      disabled: true,
    });
  });

  it('renders RichTextView when read-only', () => {
    setup({ ...def, contentCss: ['/a.css'] } as FieldDef, { value: '<p>x</p>', readOnly: true });
    expect(screen.getByTestId('view')).toBeTruthy();
    expect(seen.view).toMatchObject({ html: '<p>x</p>', contentCss: ['/a.css'], label: '內文' });
  });

  it('does not pass upload or images without uploadUrl, without images, or with empty accept', () => {
    setup(withImages);
    expect(editor().upload).toBeUndefined();
    setup(def, { uploadUrl: '/up' });
    expect(editor().upload).toBeUndefined();
    expect(editor().images).toBeUndefined();
    setup({ ...def, images: { accept: [], maxSize: 1000 } } as FieldDef, { uploadUrl: '/up' });
    expect(editor().upload).toBeUndefined();
    expect(editor().images).toBeUndefined();
  });

  it('passes images and upload when enabled', () => {
    setup(withImages, { uploadUrl: '/up' });
    expect(editor().images).toEqual({ accept: ['image/png'], maxSize: 1000 });
    expect(typeof editor().upload).toBe('function');
  });
});

function Harness({ path = 'body' }: { path?: string }) {
  const form = useFormState({ layout: 'stacked', nodes: [] }, {});
  const Component = resolveField('richText') as NonNullable<ReturnType<typeof resolveField>>;
  const props: FieldProps = {
    def: withImages,
    value: null,
    onChange: () => {},
    onBlur: () => {},
    errors: {},
    path,
    id: 'f',
    invalid: false,
    readOnly: false,
    disabled: false,
    form,
    uploadUrl: '/up',
  };
  return (
    <>
      <Component {...props} />
      <output data-testid="pending">{form.pendingUploads}</output>
    </>
  );
}

describe('richText image upload', () => {
  const file = new File(['a'], 'a.png', { type: 'image/png' });

  it('posts FormData, blocks while pending, resolves the url', async () => {
    let respond!: (v: { status: number; data: unknown }) => void;
    const request = vi.fn(
      (_r: HttpRequest) => new Promise<{ status: number; data: unknown }>((r) => (respond = r)),
    );
    renderWithBrume(<Harness />, { respond: request as never });
    let result: unknown;
    await act(async () => {
      editor()
        .upload?.(file, new AbortController().signal)
        .then((r) => {
          result = r;
        });
    });
    expect(screen.getByTestId('pending').textContent).toBe('1');
    const req = request.mock.calls[0]?.[0] as unknown as {
      body: FormData;
      url: string;
      method: string;
    };
    expect(req.method).toBe('post');
    expect(req.url).toBe('/up');
    expect(req.body.get('file')).toBeInstanceOf(File);
    expect(req.body.get('field')).toBe('body');
    await act(async () => respond({ status: 200, data: { url: '/img/a.png' } }));
    expect(result).toEqual({ ok: true, url: '/img/a.png' });
    expect(screen.getByTestId('pending').textContent).toBe('0');
  });

  it('surfaces a 422 message', async () => {
    renderWithBrume(<Harness />, {
      respond: () => ({ status: 422, data: { errors: { file: ['太大'] } } }),
    });
    let result: unknown;
    await act(async () => {
      result = await editor().upload?.(file, new AbortController().signal);
    });
    expect(result).toEqual({ ok: false, message: '太大' });
  });

  it('uses the generic failure message otherwise', async () => {
    renderWithBrume(<Harness />, {
      respond: () => ({ status: 500, data: { message: 'Storage unavailable' } }),
    });
    let result: unknown;
    await act(async () => {
      result = await editor().upload?.(file, new AbortController().signal);
    });
    expect(result).toEqual({ ok: false, message: '操作沒有完成：Storage unavailable' });
    expect(screen.getByTestId('pending').textContent).toBe('0');
  });
});

describe('richText required validation', () => {
  const required = {
    ...def,
    rules: [{ rule: 'required', message: '必填' }],
  } as FieldDef;
  it.each([
    ['<p><br></p>', '必填'],
    ['<p>&nbsp;</p>', '必填'],
    [null, '必填'],
    ['<p>x</p>', null],
    ['<p><img src="a.png"></p>', null],
  ])('%s -> %s', (value, error) => {
    expect(validateValue(required, value)).toBe(error);
  });
});

const rich = { ...withImages, name: 'body' } as FieldDef;
const repeaterDef = (extra: Partial<Record<string, unknown>> = {}) =>
  ({
    layout: 'stacked',
    nodes: [
      {
        type: 'field',
        field: {
          type: 'repeater',
          mode: 'json',
          name: 'items',
          label: 'Items',
          nodes: [{ type: 'field', field: rich }],
          ...extra,
        },
      },
    ],
  }) as FormDef;
let nestedForm: FormApi;
function Nested({ rowContext }: { rowContext?: RowContext }) {
  nestedForm = useFormState(repeaterDef(), { items: [{ _brume: { key: 'r1' }, body: null }] });
  const Component = resolveField('richText') as NonNullable<ReturnType<typeof resolveField>>;
  return rowContext ? (
    <Component
      def={rich}
      value={null}
      onChange={() => {}}
      onBlur={() => {}}
      errors={{}}
      path="items.0.body"
      id="f"
      invalid={false}
      readOnly={false}
      disabled={false}
      form={nestedForm}
      uploadUrl="/up"
      rowContext={rowContext}
    />
  ) : (
    <Nodes
      nodes={repeaterDef().nodes}
      api={nestedForm}
      idPrefix="t"
      layout="stacked"
      uploadUrl="/up"
    />
  );
}
function Related({ form }: { form: FormDef }) {
  const api = useFormState(form, { tenant: 'scope-a', products: [{ id: '31', body: null }] });
  const Component = resolveField('richText') as NonNullable<ReturnType<typeof resolveField>>;
  return (
    <Component
      def={rich}
      value={null}
      onChange={() => {}}
      onBlur={() => {}}
      errors={{}}
      path="products.0.body"
      id="f"
      invalid={false}
      readOnly={false}
      disabled={false}
      form={api}
      uploadUrl="/up"
      rowContext={api.getField('products.0.body')?.rowContext}
    />
  );
}

const sentBody = (request: { mock: { calls: unknown[][] } }) =>
  ((request.mock.calls[0] ?? [])[0] as { body: FormData }).body;
const png = new File(['a'], 'a.png', { type: 'image/png' });

describe('richText upload in nested rows', () => {
  it('sends the row context and the full field path, without ancestorSources', async () => {
    const request = vi.fn((_r: HttpRequest) => ({ status: 200, data: { url: '/i.png' } }));
    renderWithBrume(<Nested />, { respond: request });
    let result: unknown;
    await act(async () => {
      result = await editor().upload?.(png, new AbortController().signal);
    });
    expect(result).toEqual({ ok: true, url: '/i.png' });
    const body = sentBody(request);
    expect(body.get('field')).toBe('items.0.body');
    expect(JSON.parse(body.get('rowContext') as string)).toEqual([{ path: 'items', key: 'r1' }]);
    expect(body.get('ancestorSources')).toBeNull();
  });

  it('sends ancestorSources when the owning relation depends on another field', async () => {
    const request = vi.fn((_r: HttpRequest) => ({ status: 200, data: { url: '/i.png' } }));
    const form = {
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
            fields: [{ type: 'field', field: rich }],
          },
        },
      ],
    } as FormDef;
    renderWithBrume(<Related form={form} />, { respond: request });
    await act(async () => {
      await editor().upload?.(png, new AbortController().signal);
    });
    const body = sentBody(request);
    expect(JSON.parse(body.get('rowContext') as string)).toEqual([
      { path: 'products', key: '31', id: '31' },
    ]);
    expect(JSON.parse(body.get('ancestorSources') as string)).toEqual([
      { path: 'products', rowContext: [], depends: { tenant: 'scope-a' } },
    ]);
  });

  it('resolves {ok:false} without a request when the supplied rowContext does not match', async () => {
    const request = vi.fn((_r: HttpRequest) => ({ status: 200, data: { url: '/i.png' } }));
    renderWithBrume(<Nested rowContext={[{ path: 'items', key: 'other' }]} />, {
      respond: request,
    });
    let result: unknown;
    await act(async () => {
      result = await editor().upload?.(png, new AbortController().signal);
    });
    expect(result).toEqual({ ok: false, message: expect.any(String) });
    expect(request).not.toHaveBeenCalled();
    expect(nestedForm.pendingUploads).toBe(0);
  });

  it('releases the pending count when aborted and never resolves the request', async () => {
    const request = vi.fn(() => new Promise<never>(() => {}));
    renderWithBrume(<Nested />, { respond: request as never });
    const controller = new AbortController();
    await act(async () => {
      void editor().upload?.(png, controller.signal);
    });
    expect(nestedForm.pendingUploads).toBe(1);
    act(() => controller.abort());
    expect(nestedForm.pendingUploads).toBe(0);
  });
});
