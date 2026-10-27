import { createRegistry } from '@herb09638/brume-renderer';
import { type PageEnvelope, SCHEMA_VERSION } from '@herb09638/brume-schema';
import { usePage } from '@inertiajs/react';
import { render } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrumeLayout } from './brume-layout';
import { formatTitle } from './create-app';
import { LoginPage } from './pages/login';
import { BrumePage } from './pages/page';
import { makeShared } from './test-fixtures';

const headTitles: string[] = [];

vi.mock('@inertiajs/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@inertiajs/react')>()),
  usePage: vi.fn(),
  Head: ({ title }: { title?: string }) => {
    headTitles.push(title ?? '');
    return null;
  },
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function setShared(locale: 'zh-TW' | 'en', user: boolean) {
  const base = makeShared(user ? {} : { auth: { user: null } });
  vi.mocked(usePage).mockReturnValue({
    url: '/admin',
    props: { brume: { ...base, app: { ...base.app, locale } } },
  } as unknown as ReturnType<typeof usePage>);
}

beforeEach(() => {
  headTitles.length = 0;
  document.documentElement.lang = '';
});

describe('formatTitle', () => {
  it('joins page title and app name, or falls back to the app name', () => {
    expect(formatTitle('使用者列表', 'Brume Admin')).toBe('使用者列表 · Brume Admin');
    expect(formatTitle('', 'Brume Admin')).toBe('Brume Admin');
  });
});

describe('page titles', () => {
  it('brume/page renders Head with the envelope page title', () => {
    setShared('zh-TW', true);
    const envelope: PageEnvelope = {
      schemaVersion: SCHEMA_VERSION,
      page: {
        type: 'list',
        title: '使用者列表',
        columns: [],
        rows: [],
        pagination: { page: 1, perPage: 20, total: 0, lastPage: 1 },
      },
    };
    const registry = createRegistry({ mode: 'precompiled' });
    render(
      <BrumeLayout registry={registry}>
        <BrumePage envelope={envelope} />
      </BrumeLayout>,
    );
    expect(headTitles).toContain('使用者列表');
  });

  it('brume/login renders Head with the login title', () => {
    setShared('zh-TW', false);
    render(<LoginPage />);
    expect(headTitles).toContain('登入');
  });
});

describe('<html lang>', () => {
  it('follows the shared locale when it changes', () => {
    const registry = createRegistry({ mode: 'precompiled' });
    const ui = () => (
      <BrumeLayout registry={registry}>
        <p>內容</p>
      </BrumeLayout>
    );
    setShared('zh-TW', true);
    const { rerender } = render(ui());
    expect(document.documentElement.lang).toBe('zh-TW');
    setShared('en', true);
    rerender(ui());
    expect(document.documentElement.lang).toBe('en');
  });

  it('login also sets it', () => {
    setShared('en', false);
    render(<LoginPage />);
    expect(document.documentElement.lang).toBe('en');
  });
});
