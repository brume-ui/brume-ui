import {
  BrumeProvider,
  createMemoryAdapter,
  type HttpRequest,
  type HttpResponse,
  type Locale,
} from '@brume-ui/brume-react';
import { type RenderResult, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { type ComponentRegistry, createRegistry } from './registry';
import { RegistryProvider } from './registry-context';

/** Renders inside BrumeProvider + RegistryProvider; `rerender` keeps both (and the same adapter). */
export function renderWithBrume(
  ui: ReactNode,
  opts: {
    registry?: ComponentRegistry;
    locale?: Locale;
    url?: string;
    /** Answers `adapter.request` (default: 200 with `{}`). */
    respond?(req: HttpRequest): HttpResponse | Promise<HttpResponse>;
  } = {},
): RenderResult & { adapter: ReturnType<typeof createMemoryAdapter> } {
  const adapter = createMemoryAdapter(opts.url ?? '/admin/users', { respond: opts.respond });
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
