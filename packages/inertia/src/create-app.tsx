import {
  type ComponentRegistry,
  createRegistry,
  type RegistryMode,
} from '@herb09638/brume-renderer';
import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react';
import type { ComponentType, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrumeLayout } from './brume-layout';
import { LoginPage } from './pages/login';
import { BrumePage } from './pages/page';

// biome-ignore lint/suspicious/noExplicitAny: page components define their own props
type PageModules = Record<string, () => Promise<{ default: ComponentType<any> }>>;

export interface CreateBrumeAppOptions {
  mode: RegistryMode;
  // biome-ignore lint/suspicious/noExplicitAny: custom components define their own props
  components?: Record<string, ComponentType<any>>;
  /** Hand-written pages, e.g. `import.meta.glob('./pages/**\/*.tsx')`. */
  pages?: PageModules;
  /** Id selector of the mount element (Inertia reads the initial page from it). Default `#app`. */
  el?: string;
}

export const INERTIA_PROGRESS = {
  color: 'var(--br-accent)',
  delay: 150,
  showSpinner: false,
} as const;

function withLayout(page: ResolvedComponent, registry: ComponentRegistry): ResolvedComponent {
  page.layout ??= (child: ReactNode) => <BrumeLayout registry={registry}>{child}</BrumeLayout>;
  return page;
}

/**
 * Maps an Inertia component name to a page component.
 * `brume/page` and `brume/login` are built in; other names load `./pages/<name>.tsx` from `pages`.
 * Every page except login gets the persistent BrumeLayout unless it already declares a layout.
 */
export async function resolvePage(
  name: string,
  opts: { registry: ComponentRegistry; pages?: PageModules },
): Promise<ResolvedComponent> {
  if (name === 'brume/login') return LoginPage;
  if (name === 'brume/page') {
    // Built-in: always bind to this app's registry.
    const page: ResolvedComponent = BrumePage;
    page.layout = (child: ReactNode) => <BrumeLayout registry={opts.registry}>{child}</BrumeLayout>;
    return page;
  }
  const load = opts.pages?.[`./pages/${name}.tsx`];
  if (!load) {
    throw new Error(
      `Brume: page "${name}" not found. Expected ./pages/${name}.tsx in the pages passed to createBrumeApp.`,
    );
  }
  const mod = await load();
  return withLayout(mod.default, opts.registry);
}

export function createBrumeApp(opts: CreateBrumeAppOptions): Promise<void> {
  const registry = createRegistry({ mode: opts.mode, components: opts.components });
  return createInertiaApp({
    id: (opts.el ?? '#app').replace(/^#/, ''),
    resolve: (name) => resolvePage(name, { registry, pages: opts.pages }),
    setup({ el, App, props }) {
      createRoot(el).render(<App {...props} />);
    },
    progress: INERTIA_PROGRESS,
  });
}
