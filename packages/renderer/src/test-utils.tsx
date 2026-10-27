import { BrumeProvider, createMemoryAdapter, type Locale } from '@herb09638/brume-react';
import { type RenderResult, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { type ComponentRegistry, createRegistry } from './registry';
import { RegistryProvider } from './registry-context';

export function renderWithBrume(
  ui: ReactNode,
  opts: { registry?: ComponentRegistry; locale?: Locale; url?: string } = {},
): RenderResult & { adapter: ReturnType<typeof createMemoryAdapter> } {
  const adapter = createMemoryAdapter(opts.url ?? '/admin/users');
  const registry = opts.registry ?? createRegistry({ mode: 'precompiled' });
  const result = render(
    <BrumeProvider adapter={adapter} locale={opts.locale}>
      <RegistryProvider registry={registry}>{ui}</RegistryProvider>
    </BrumeProvider>,
  );
  return { adapter, ...result };
}
