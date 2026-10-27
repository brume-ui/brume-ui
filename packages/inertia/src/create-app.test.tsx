import { createRegistry } from '@herb09638/brume-renderer';
import { type PageEnvelope, SCHEMA_VERSION } from '@herb09638/brume-schema';
import { usePage } from '@inertiajs/react';
import { render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { resolvePage } from './create-app';
import { LoginPage } from './pages/login';
import { makeShared } from './test-fixtures';

vi.mock('@inertiajs/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@inertiajs/react')>()),
  usePage: vi.fn(),
}));

import { BrumePage } from './pages/page';

const registry = createRegistry({ mode: 'vite' });
const Reports = () => <p>報表內容</p>;
const Custom = Object.assign(() => null, { layout: (p: ReactElement) => p });

describe('resolvePage', () => {
  it('brume/page resolves to the built-in page with a persistent BrumeLayout', async () => {
    const Page = await resolvePage('brume/page', { registry });
    expect(Page).toBe(BrumePage);
    expect(typeof Page.layout).toBe('function');
    const el = (Page.layout as (p: ReactElement) => ReactElement)(<p />);
    expect((el.type as { name: string }).name).toBe('BrumeLayout');
    expect((el.props as { registry: unknown }).registry).toBe(registry);
  });

  it('brume/login resolves to the built-in login without the shell layout', async () => {
    const Page = await resolvePage('brume/login', { registry });
    expect(Page).toBe(LoginPage);
    expect(Page.layout).toBeUndefined();
  });

  it('resolves other names from pages and applies the layout unless one is set', async () => {
    const pages = {
      './pages/app/reports.tsx': async () => ({ default: Reports }),
      './pages/app/custom.tsx': async () => ({ default: Custom }),
    };
    const reports = await resolvePage('app/reports', { registry, pages });
    expect(reports).toBe(Reports);
    expect(typeof reports.layout).toBe('function');
    const custom = await resolvePage('app/custom', { registry, pages });
    expect(custom.layout).toBe(Custom.layout);
  });

  it('throws an error naming an unknown page', async () => {
    await expect(resolvePage('app/nope', { registry, pages: {} })).rejects.toThrow('app/nope');
  });
});

describe('persistent layout through resolvePage', () => {
  it('keeps the same shell mounted when switching from brume/page to a handwritten page', async () => {
    vi.mocked(usePage).mockReturnValue({
      url: '/admin/users',
      props: { brume: makeShared() },
    } as unknown as ReturnType<typeof usePage>);
    const pages = { './pages/app/reports.tsx': async () => ({ default: Reports }) };
    const PageA = await resolvePage('brume/page', { registry, pages });
    const PageB = await resolvePage('app/reports', { registry, pages });
    const layoutOf = (P: typeof PageA) => P.layout as (page: ReactNode) => ReactNode;
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

    const { rerender } = render(layoutOf(PageA)(<PageA envelope={envelope} />));
    const mount = document.querySelector('[data-shell-mount]')?.getAttribute('data-shell-mount');
    expect(mount).toBeTruthy();
    expect(screen.getByRole('heading', { name: '使用者列表' })).toBeTruthy();

    rerender(layoutOf(PageB)(<PageB />));
    expect(screen.getByText('報表內容')).toBeTruthy();
    expect(document.querySelector('[data-shell-mount]')?.getAttribute('data-shell-mount')).toBe(
      mount,
    );
  });
});
