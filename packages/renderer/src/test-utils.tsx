import { BrumeProvider, createMemoryAdapter, type Locale } from '@brume-ui/brume-react';
import { type RenderResult, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { type ComponentRegistry, createRegistry } from './registry';
import { RegistryProvider } from './registry-context';

/** Renders inside BrumeProvider + RegistryProvider; `rerender` keeps both (and the same adapter). */
export function renderWithBrume(
  ui: ReactNode,
  opts: { registry?: ComponentRegistry; locale?: Locale; url?: string } = {},
): RenderResult & { adapter: ReturnType<typeof createMemoryAdapter> } {
  const adapter = createMemoryAdapter(opts.url ?? '/admin/users');
  const registry = opts.registry ?? createRegistry({ mode: 'precompiled' });
  const result = render(ui, {
    wrapper: ({ children }) => (
      <BrumeProvider adapter={adapter} locale={opts.locale}>
        <RegistryProvider registry={registry}>{children}</RegistryProvider>
      </BrumeProvider>
    ),
  });
  return { adapter, ...result };
}
