import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { formatBytes, type UploadItem, UploadList, type UploadListProps } from './upload-list';

const a: UploadItem = { key: 'a', name: 'a.png', status: 'done', url: '/a.png', size: 100 };
const b: UploadItem = { key: 'b', name: 'b.png', status: 'done' };
const pending = () => new Promise<never>(() => {});
function Harness({
  initial = [],
  ...props
}: Partial<UploadListProps> & { initial?: UploadItem[] }) {
  const [items, setItems] = useState(initial);
  return (
    <BrumeProvider adapter={createMemoryAdapter()}>
      <UploadList
        kind="image"
        multiple
        accept={['image/png']}
        maxSize={1000}
        label="圖片"
        upload={pending}
        {...props}
        items={items}
        onItemsChange={(next) => {
          setItems(next);
          props.onItemsChange?.(next);
        }}
      />
    </BrumeProvider>
  );
}
const choose = (...files: File[]) =>
  fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {
    target: { files },
  });
const png = (name = 'new.png') => new File(['x'], name, { type: 'image/png' });
describe('UploadList', () => {
  it('rejects a file over maxSize without uploading', () => {
    const upload = vi.fn(pending);
    render(<Harness maxSize={0} upload={upload} />);
    choose(png());
    expect(screen.getByText(/檔案超過/)).toBeTruthy();
    expect(upload).not.toHaveBeenCalled();
  });
  it('rejects a type outside accept and lists allowed types', () => {
    const upload = vi.fn(pending);
    render(<Harness upload={upload} />);
    choose(new File(['x'], 'a.txt', { type: 'text/plain' }));
    expect(screen.getByText(/請上傳 image\/png/)).toBeTruthy();
    expect(upload).not.toHaveBeenCalled();
  });
  it('rejects excess files without uploading them', () => {
    const upload = vi.fn(pending);
    render(<Harness maxFiles={1} upload={upload} />);
    choose(png('one.png'), png('two.png'));
    expect(screen.getByText('最多 1 個檔案。')).toBeTruthy();
    expect(upload).toHaveBeenCalledTimes(1);
  });
  it('removing an uploading item aborts it and ignores its late response', async () => {
    let signal!: AbortSignal;
    let resolve!: (v: { ok: false; message: string }) => void;
    render(
      <Harness
        upload={(_, s) => {
          signal = s;
          return new Promise((r) => {
            resolve = r;
          });
        }}
      />,
    );
    choose(png());
    expect(screen.getByRole('group', { name: '圖片' }).getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('progressbar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '移除 new.png' }));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ ok: false, message: 'late' }));
    expect(screen.queryByText('late')).toBeNull();
  });
  it('move down with the keyboard keeps focus on the moved item', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[a, b]} sortable />);
    const button = screen.getByRole('button', { name: '下移 a.png' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('listitem').map((x) => x.textContent?.includes('a.png'))).toEqual([
      false,
      true,
    ]);
    expect(document.activeElement?.closest('li')?.textContent).toContain('a.png');
  });
  it('reorders by dragging a handle onto another item', () => {
    const spy = vi.fn();
    render(<Harness initial={[a, b]} sortable onItemsChange={spy} />);
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(screen.getByRole('button', { name: '排序 a.png' }), { dataTransfer });
    fireEvent.drop(screen.getAllByRole('listitem')[1] as HTMLElement, { dataTransfer });
    expect(spy).toHaveBeenLastCalledWith([b, a]);
  });
  it('renders per-file extras and links each server error to its own item', () => {
    render(
      <Harness
        initial={[a, b]}
        renderExtra={(_, i) => <input aria-label={`extra ${i}`} />}
        itemErrors={(i) => (i === 1 ? 'second error' : undefined)}
      />,
    );
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0] as HTMLElement).getByLabelText('extra 0')).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByLabelText('extra 1')).toBeTruthy();
    expect(
      document.getElementById(rows[1]?.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('second error');
  });
  it('replaces a single upload and aborts the previous request', () => {
    const signals: AbortSignal[] = [];
    render(
      <Harness
        multiple={false}
        upload={(_, s) => {
          signals.push(s);
          return pending();
        }}
      />,
    );
    choose(png('first.png'));
    choose(png('second.png'));
    expect(signals[0]?.aborted).toBe(true);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
  it('stores successful tokens, previews and handles rejected requests', async () => {
    const upload = vi
      .fn<UploadListProps['upload']>()
      .mockResolvedValueOnce({
        ok: true,
        value: {
          token: 'token',
          name: 'saved.png',
          size: 3,
          mime: 'image/png',
          previewUrl: '/preview',
          expiresAt: '2026-11-01T00:00:00Z',
        },
      })
      .mockRejectedValueOnce(new Error('offline'));
    const spy = vi.fn();
    render(<Harness upload={upload} onItemsChange={spy} />);
    choose(png());
    await act(async () => {});
    expect(spy.mock.lastCall?.[0][0].value).toEqual({ token: 'token' });
    expect(screen.getByRole('img').getAttribute('src')).toBe('/preview');
    choose(png('fail.png'));
    await act(async () => {});
    expect(screen.getByText('上傳失敗，請再試一次。')).toBeTruthy();
  });
  it('blocks unsafe image URLs and disables all mutations', () => {
    const spy = vi.fn();
    render(
      <Harness
        initial={[{ ...a, url: 'javascript:alert(1)', previewUrl: 'javascript:alert(2)' }, b]}
        disabled
        sortable
        onItemsChange={spy}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    choose(png());
    fireEvent.click(screen.getByRole('button', { name: '移除 a.png' }));
    expect(spy).not.toHaveBeenCalled();
  });
  it('accepts file drops, extensions and MIME wildcards', () => {
    const upload = vi.fn(pending);
    render(<Harness accept={['.png', 'text/*']} upload={upload} />);
    fireEvent.drop(screen.getByRole('button', { name: /拖曳/ }), {
      dataTransfer: { files: [png(), new File(['x'], 'a.txt', { type: 'text/plain' })] },
    });
    expect(upload).toHaveBeenCalledTimes(2);
  });
  it('formats decimal byte units using the requested locale', () => {
    expect(formatBytes(10000000, 'en')).toBe('10 MB');
    expect(formatBytes(1500, 'de')).toBe('1,5 KB');
    expect(formatBytes(0, 'en')).toBe('0 B');
  });
});
