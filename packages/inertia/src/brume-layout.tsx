import { AppShell, BrumeProvider, ConfirmHost, Toaster } from '@herb09638/brume-react';
import { type ComponentRegistry, RegistryProvider } from '@herb09638/brume-renderer';
import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { inertiaAdapter } from './default-adapter';
import { useFlashToast } from './flash';
import { changeLocale } from './locale';
import { useHtmlLang } from './use-html-lang';
import { useShared } from './use-shared';

/** Persistent layout: stays mounted across Inertia visits, only `children` changes. */
export function BrumeLayout({
  registry,
  children,
}: {
  registry: ComponentRegistry;
  children: ReactNode;
}) {
  const shared = useShared();
  const { url } = usePage();
  useFlashToast(shared.flash);
  const { app } = shared;
  useHtmlLang(app.locale);

  return (
    <BrumeProvider adapter={inertiaAdapter} locale={app.locale}>
      <RegistryProvider registry={registry}>
        <AppShell
          appName={app.name}
          menu={shared.menu}
          currentUrl={url}
          homeUrl={app.homeUrl}
          user={shared.auth.user}
          breadcrumbs={shared.breadcrumbs}
          layout={app.layout}
          logoutUrl={app.logoutUrl}
          onLocaleChange={app.locales.length > 1 ? changeLocale : undefined}
        >
          {children}
        </AppShell>
      </RegistryProvider>
      <Toaster />
      <ConfirmHost />
    </BrumeProvider>
  );
}
