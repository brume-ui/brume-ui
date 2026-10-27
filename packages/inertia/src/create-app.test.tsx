import { createRegistry } from '@herb09638/brume-renderer';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { resolvePage } from './create-app';
import { LoginPage } from './pages/login';
import { BrumePage } from './pages/page';

const registry = createRegistry({ mode: 'vite' });
const Reports = () => null;
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
