import {
  BrumeProvider,
  ConfirmHost,
  createMemoryAdapter,
  type Locale,
  Toaster,
} from '@herb09638/brume-react';
import { useEffect, useMemo, useState } from 'react';
import { ShellPage } from './pages/shell';
import { INDEX_ENTRIES, ROUTES, SHELL_ROUTE } from './routes';
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

function IndexPage() {
  return (
    <main className="pg-page" data-testid="pg-index">
      <h1>Brume Playground</h1>
      <p className="pg-lead">One page per component. Use the bar above to switch settings.</p>
      <ul className="pg-index">
        {INDEX_ENTRIES.map((e) => (
          <li key={e.name}>
            <a href={`#/${e.name}`}>{e.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function App() {
  const [locale, setLocale] = useState<Locale>('zh-TW');
  const adapter = useMemo(() => createMemoryAdapter('/admin/users?page=2'), []);
  const route = useHashRoute();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  let view: React.ReactNode;
  if (route === SHELL_ROUTE) view = <ShellPage onLocaleChange={setLocale} />;
  else {
    const match = ROUTES.find((r) => r.name === route);
    view = match ? <match.Component /> : <IndexPage />;
  }

  return (
    <SettingsProvider route={route}>
      <BrumeProvider adapter={adapter} locale={locale}>
        <SwitcherBar locale={locale} onLocaleChange={setLocale} />
        {view}
        <ConfirmHost />
        <Toaster />
      </BrumeProvider>
    </SettingsProvider>
  );
}
