import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { ConfirmHost, useConfirm } from './confirm';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

type Opts = Parameters<ReturnType<typeof useConfirm>>[0];

function Harness({ opts, onResult }: { opts: Opts; onResult: (v: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={async () => onResult(await confirm(opts))}>
      開始
    </button>
  );
}

function setup(opts: Opts) {
  const results: boolean[] = [];
  render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <Harness opts={opts} onResult={(v) => results.push(v)} />
      <ConfirmHost />
    </BrumeProvider>,
  );
  return results;
}

describe('useConfirm', () => {
  it('resolves true on the confirm button', async () => {
    const user = userEvent.setup();
    const results = setup({ title: '刪除此項目？', confirmLabel: '刪除項目' });
    await user.click(screen.getByRole('button', { name: '開始' }));
    expect(screen.getByRole('alertdialog', { name: '刪除此項目？' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '刪除項目' }));
    expect(results).toEqual([true]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('resolves false on the cancel button (default label from locale)', async () => {
    const user = userEvent.setup();
    const results = setup({ title: '刪除此項目？', confirmLabel: '刪除項目' });
    await user.click(screen.getByRole('button', { name: '開始' }));
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(results).toEqual([false]);
  });

  it('resolves false on Esc', async () => {
    const user = userEvent.setup();
    const results = setup({ title: '刪除此項目？', confirmLabel: '刪除項目' });
    await user.click(screen.getByRole('button', { name: '開始' }));
    await user.keyboard('{Escape}');
    expect(results).toEqual([false]);
  });

  it('danger tone: initial focus on cancel and confirm button is danger', async () => {
    const user = userEvent.setup();
    setup({ title: '刪除？', confirmLabel: '刪除項目', tone: 'danger', cancelLabel: '先不要' });
    await user.click(screen.getByRole('button', { name: '開始' }));
    const cancel = screen.getByRole('button', { name: '先不要' });
    expect(document.activeElement).toBe(cancel);
    expect(screen.getByRole('button', { name: '刪除項目' }).className).toContain('br:bg-danger');
  });
});
