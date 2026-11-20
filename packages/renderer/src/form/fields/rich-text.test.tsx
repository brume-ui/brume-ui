import type { HttpRequest } from '@brume-ui/brume-react';
import type { FieldDef } from '@brume-ui/brume-schema';
import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveField } from '../../index';
import { renderWithBrume } from '../../test-utils';
import type { FieldProps } from '../contract';
import { useFormState } from '../use-form-state';
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
