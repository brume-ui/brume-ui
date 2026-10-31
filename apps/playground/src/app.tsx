import {
  BrumeProvider,
  ConfirmHost,
  createMemoryAdapter,
  type Locale,
  Toaster,
} from '@brume-ui/brume-react';
import { useEffect, useMemo, useState } from 'react';
import { DEMO_FEATURES } from './demo-catalog';
import { DemoCatalogPage } from './pages/demo-catalog';
import { DemoGuide } from './pages/demo-guide';
import { ShellPage } from './pages/shell';
import { ROUTES, SHELL_ROUTE } from './routes';
import { SettingsProvider } from './settings';
import { SwitcherBar } from './switcher-bar';

function currentRoute(): string {
  return window.location.hash.replace(/^#\/?/, '').split('?')[0] ?? '';
}

function useHashRoute(): string {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onChange = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function App() {
  const [locale, setLocale] = useState<Locale>('zh-TW');
  const adapter = useMemo(() => createMemoryAdapter('/admin/users?page=2'), []);
  const route = useHashRoute();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const match = ROUTES.find((r) => r.name === route);
  let view: React.ReactNode;
  if (route === SHELL_ROUTE) view = <ShellPage onLocaleChange={setLocale} />;
  else {
    view = match ? <match.Component /> : <DemoCatalogPage />;
  }
  const feature = DEMO_FEATURES.find((item) => item.href === `#/${route}`);

  return (
    <SettingsProvider route={route}>
      <BrumeProvider adapter={adapter} locale={locale}>
        <SwitcherBar locale={locale} onLocaleChange={setLocale} />
        {feature && route !== SHELL_ROUTE && !match?.ownsGuide ? (
          <DemoGuide featureId={feature.id}>{view}</DemoGuide>
        ) : (
          view
        )}
        <ConfirmHost />
        <Toaster />
      </BrumeProvider>
    </SettingsProvider>
  );
}
