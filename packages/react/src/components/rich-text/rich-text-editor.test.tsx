import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../../memory-adapter';
import { BrumeProvider } from '../../provider';
import { clearToasts, getToasts } from '../toast-store';
import type { JoditEditorProps } from './editor-contract';
import { editorChunk, RichTextEditor, type RichTextEditorProps } from './rich-text-editor';

// jsdom cannot run Jodit: the real chunk must never load in these tests.
vi.mock('./jodit-editor', () => {
  throw new Error('the Jodit chunk must not load in jsdom');
});

/** The last props the fake editor received. */
let lastProps: JoditEditorProps | null = null;

function FakeEditor(props: JoditEditorProps) {
  lastProps = props;
  return (
    <textarea
      data-testid="fake-editor"
      aria-label={props.label}
      value={props.value ?? ''}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.target.value === '' ? null : e.target.value)}
      onBlur={() => props.onBlur?.()}
    />
  );
}

function resolvedChunk() {
  return vi
    .spyOn(editorChunk, 'load')
    .mockImplementation(() =>
      Promise.resolve({ default: FakeEditor as ComponentType<JoditEditorProps> }),
    );
}

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const onChange = vi.fn();
  const all: RichTextEditorProps = { label: '商品說明', value: null, onChange, ...props };
  const utils = render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <RichTextEditor {...all} />
    </BrumeProvider>,
  );
  const rerender = (next: Partial<RichTextEditorProps>) =>
    utils.rerender(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <RichTextEditor {...all} {...next} />
      </BrumeProvider>,
    );
  return { ...utils, onChange, rerender };
}

afterEach(() => {
  vi.restoreAllMocks();
  lastProps = null;
  clearToasts();
});

describe('RichTextEditor', () => {
  it('shows a skeleton of the final height, then the editor', async () => {
    let resolve!: (m: { default: ComponentType<JoditEditorProps> }) => void;
    vi.spyOn(editorChunk, 'load').mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { container } = renderEditor({ height: 320 });
    const root = container.querySelector('.br-rich-text') as HTMLElement;
    expect(root.style.height).toBe('320px');
    expect(screen.getByRole('status', { name: '編輯器載入中' })).toBeTruthy();
    expect(screen.queryByTestId('fake-editor')).toBeNull();
    await act(async () => resolve({ default: FakeEditor }));
    expect(await screen.findByTestId('fake-editor')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(lastProps?.height).toBe(320);
  });

  it('defaults to 500px', () => {
    resolvedChunk();
    const { container } = renderEditor();
    expect((container.querySelector('.br-rich-text') as HTMLElement).style.height).toBe('500px');
  });

  it('readOnly renders the sandboxed view and never loads the chunk', () => {
    const load = resolvedChunk();
    renderEditor({ readOnly: true, value: '<p>唯讀內容</p>' });
    const frame = screen.getByTitle('商品說明');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('srcdoc')).toContain('<p>唯讀內容</p>');
    expect(load).not.toHaveBeenCalled();
  });

  it('passes value null as null and forwards html and null from the editor', async () => {
    resolvedChunk();
    const { onChange, rerender } = renderEditor({ value: null });
    const box = (await screen.findByTestId('fake-editor')) as HTMLTextAreaElement;
    expect(lastProps?.value).toBeNull();
    expect(box.value).toBe('');
    fireEvent.change(box, { target: { value: '<p>新內容</p>' } });
    expect(onChange).toHaveBeenLastCalledWith('<p>新內容</p>');
    act(() => lastProps?.onChange(null));
    expect(onChange).toHaveBeenLastCalledWith(null);
    rerender({ value: '<p>外部更新</p>' });
    expect(lastProps?.value).toBe('<p>外部更新</p>');
  });

  it('shows an inline error with retry when the chunk fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi
      .spyOn(editorChunk, 'load')
      .mockImplementationOnce(() => Promise.reject(new Error('chunk 404')))
      .mockImplementation(() => Promise.resolve({ default: FakeEditor }));
    renderEditor();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('編輯器載入失敗');
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    expect(await screen.findByTestId('fake-editor')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('maps the locale and Field props to the editor', async () => {
    resolvedChunk();
    const { container } = renderEditor({
      id: 'desc',
      'aria-labelledby': 'desc-label',
      'aria-describedby': 'desc-error',
      'aria-invalid': true,
      'aria-required': true,
      contentCss: ['/site.css'],
      placeholder: '輸入說明',
    });
    await screen.findByTestId('fake-editor');
    const root = container.querySelector('.br-rich-text') as HTMLElement;
    expect(root.id).toBe('desc');
    expect(root.className).toContain('br:border-danger');
    expect(lastProps).toMatchObject({
      language: 'zh_tw',
      label: '商品說明',
      labelledBy: 'desc-label',
      describedBy: 'desc-error',
      invalid: true,
      required: true,
      contentCss: ['/site.css'],
      placeholder: '輸入說明',
      disabled: false,
    });
  });

  it('disabled is passed on and dims the box', async () => {
    resolvedChunk();
    const { container } = renderEditor({ disabled: true });
    await screen.findByTestId('fake-editor');
    const root = container.querySelector('.br-rich-text') as HTMLElement;
    expect(root.getAttribute('data-disabled')).toBe('');
    expect(root.className).toContain('br:cursor-not-allowed');
    expect(lastProps?.disabled).toBe(true);
  });

  it('exposes data-uploading while uploads are in flight', async () => {
    resolvedChunk();
    const { container } = renderEditor();
    await screen.findByTestId('fake-editor');
    const root = container.querySelector('.br-rich-text') as HTMLElement;
    expect(root.hasAttribute('data-uploading')).toBe(false);
    act(() => lastProps?.onUploadingChange(1));
    act(() => lastProps?.onUploadingChange(1));
    expect(root.getAttribute('data-uploading')).toBe('2');
    act(() => lastProps?.onUploadingChange(-1));
    act(() => lastProps?.onUploadingChange(-1));
    expect(root.hasAttribute('data-uploading')).toBe(false);
  });

  it('resets data-uploading when the editor instance goes away (remount, readOnly)', async () => {
    resolvedChunk();
    const { container, rerender } = renderEditor({ contentCss: ['/a.css'] });
    await screen.findByTestId('fake-editor');
    const root = () => container.querySelector('.br-rich-text') as HTMLElement;
    act(() => lastProps?.onUploadingChange(1));
    expect(root().getAttribute('data-uploading')).toBe('1');
    rerender({ contentCss: ['/b.css'] }); // new Jodit instance
    await screen.findByTestId('fake-editor');
    expect(root().hasAttribute('data-uploading')).toBe(false);
    act(() => lastProps?.onUploadingChange(1));
    rerender({ contentCss: ['/b.css'], readOnly: true });
    rerender({ contentCss: ['/b.css'], readOnly: false });
    await screen.findByTestId('fake-editor');
    expect(root().hasAttribute('data-uploading')).toBe(false);
  });

  it('drops unsafe contentCss urls before they reach the editor', async () => {
    resolvedChunk();
    renderEditor({ contentCss: ['/site.css', 'javascript:alert(1)', ' '] });
    await screen.findByTestId('fake-editor');
    expect(lastProps?.contentCss).toEqual(['/site.css']);
  });

  it('readOnly keeps the Field id and description', () => {
    resolvedChunk();
    renderEditor({
      readOnly: true,
      value: '<p>x</p>',
      id: 'desc',
      'aria-describedby': 'desc-hint',
    });
    const frame = screen.getByTitle('商品說明');
    expect(frame.id).toBe('desc');
    expect(frame.getAttribute('aria-describedby')).toBe('desc-hint');
  });

  it('prevents the browser default for a file dropped on the box', async () => {
    resolvedChunk();
    const { container } = renderEditor();
    await screen.findByTestId('fake-editor');
    const root = container.querySelector('.br-rich-text') as HTMLElement;
    const dataTransfer = { types: ['Files'], files: [] };
    const over = fireEvent.dragOver(root, { dataTransfer });
    const drop = fireEvent.drop(root, { dataTransfer });
    expect(over).toBe(false);
    expect(drop).toBe(false);
  });

  it('enables image upload only with images and upload; checks type and size', async () => {
    resolvedChunk();
    const upload = vi.fn(async () => ({ ok: true as const, url: '/storage/a.png' }));
    const { rerender } = renderEditor({ images: { accept: ['image/png'], maxSize: 1024 } });
    await screen.findByTestId('fake-editor');
    expect(lastProps?.imagesEnabled).toBe(false);
    rerender({ images: { accept: ['image/png', 'image/jpeg'], maxSize: 1024 }, upload });
    expect(lastProps?.imagesEnabled).toBe(true);
    const png = new File(['x'], 'a.png', { type: 'image/png' });
    const gif = new File(['x'], 'a.gif', { type: 'image/gif' });
    const big = new File([new Uint8Array(2048)], 'b.png', { type: 'image/png' });
    expect(lastProps?.validateImage(png)).toBeNull();
    expect(lastProps?.validateImage(gif)).toBe('不支援這種檔案格式，請上傳 PNG、JPG。');
    expect(lastProps?.validateImage(big)).toBe('檔案超過 1 KB，請換一個較小的檔案。');
  });

  it('turns an unsafe upload url into a failure', async () => {
    resolvedChunk();
    const upload = vi.fn(async () => ({ ok: true as const, url: 'javascript:alert(1)' }));
    renderEditor({ images: { accept: ['image/png'], maxSize: 1024 }, upload });
    await screen.findByTestId('fake-editor');
    const signal = new AbortController().signal;
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(lastProps?.upload(file, signal)).resolves.toEqual({
      ok: false,
      message: '上傳失敗，請再試一次。',
    });
    expect(upload).toHaveBeenCalledWith(file, signal);
  });

  it('passes the uploaded file name on with a safe url', async () => {
    resolvedChunk();
    const upload = vi.fn(async () => ({ ok: true as const, url: '/s/a.png', name: '產品圖.png' }));
    renderEditor({ images: { accept: ['image/png'], maxSize: 1024 }, upload });
    await screen.findByTestId('fake-editor');
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(lastProps?.upload(file, new AbortController().signal)).resolves.toEqual({
      ok: true,
      url: '/s/a.png',
      name: '產品圖.png',
    });
  });

  it('has a dropped-images message in each locale', async () => {
    resolvedChunk();
    const expected = {
      'zh-TW': '有 2 張圖片無法貼上，請改用工具列的圖片按鈕上傳。',
      'zh-CN': '有 2 张图片无法粘贴，请改用工具栏的图片按钮上传。',
      en: "2 images couldn't be pasted. Upload them with the image button in the toolbar.",
    } as const;
    for (const [locale, message] of Object.entries(expected)) {
      const { unmount } = render(
        <BrumeProvider adapter={createMemoryAdapter()} locale={locale as keyof typeof expected}>
          <RichTextEditor label="x" value={null} onChange={() => {}} />
        </BrumeProvider>,
      );
      await screen.findByTestId('fake-editor');
      expect(lastProps?.messages.imagesDropped(2)).toBe(message);
      unmount();
    }
  });

  it('labels the paragraph menu in the locale', async () => {
    resolvedChunk();
    const expected = {
      'zh-TW': { p: '內文段落', h1: '標題 1', h2: '標題 2', h3: '標題 3' },
      'zh-CN': { p: '正文段落', h1: '标题 1', h2: '标题 2', h3: '标题 3' },
      en: { p: 'Paragraph', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' },
    } as const;
    for (const [locale, labels] of Object.entries(expected)) {
      const { unmount } = render(
        <BrumeProvider adapter={createMemoryAdapter()} locale={locale as keyof typeof expected}>
          <RichTextEditor label="x" value={null} onChange={() => {}} />
        </BrumeProvider>,
      );
      await screen.findByTestId('fake-editor');
      expect(lastProps?.messages.blockLabels).toEqual(labels);
      unmount();
    }
  });

  it('notify shows an error toast', async () => {
    resolvedChunk();
    renderEditor();
    await screen.findByTestId('fake-editor');
    act(() => lastProps?.notify('只支援 YouTube 網址'));
    await waitFor(() =>
      expect(getToasts().some((t) => t.message === '只支援 YouTube 網址')).toBe(true),
    );
  });
});
