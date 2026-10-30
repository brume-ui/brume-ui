import {
  AppShell,
  type BrumeAdapter,
  BrumeProvider,
  createMemoryAdapter,
  toast,
  useBrume,
} from '@brume-ui/brume-react';
import { BrumePageView, createRegistry, RegistryProvider } from '@brume-ui/brume-renderer';
import { type GridRow, type MenuItem, SCHEMA_VERSION } from '@brume-ui/brume-schema';
import { type ReactNode, useMemo, useState } from 'react';
import { useSettings } from '../settings';
import { respondForm } from './form-data';
import {
  buildOrdersPage,
  createOrderDb,
  ORDERS_URL,
  type OrderDb,
  respondOrders,
} from './grid-data';

/** `RiskScore`, the `component` display of the 風險分數 column. */
function RiskScore({ context }: { context?: { row: GridRow } }) {
  const score = Number(context?.row.risk ?? 0);
  const level = score >= 70 ? '高' : score >= 40 ? '中' : '低';
  const color =
    score >= 70 ? 'var(--br-danger)' : score >= 40 ? 'var(--br-warning)' : 'var(--br-success)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: 999, background: color }}
      />
      {level} {score}
    </span>
  );
}

const MENU: MenuItem[] = [
  { title: '儀表板', icon: 'layout-dashboard', url: '/admin' },
  {
    title: '銷售',
    icon: 'shopping-cart',
    children: [
      { title: '訂單', url: ORDERS_URL },
      { title: '退款', url: '/admin/refunds' },
    ],
  },
  { title: '設定', icon: 'settings', url: '/admin/settings' },
];

const pathOf = (url: string) => url.split(/[?#]/)[0];

/**
 * A fake server behind the grid: `visit` re-renders the list page for the new URL (filtered and
 * sorted locally), `reload` re-reads the in-memory table, `request` goes to the fake endpoints.
 * Visits that leave the list only say where they would go.
 */
function useOrdersServer(db: OrderDb) {
  const [url, setUrl] = useState(ORDERS_URL);
  const [version, setVersion] = useState(0);
  const adapter = useMemo<BrumeAdapter>(() => {
    const base = createMemoryAdapter(ORDERS_URL, {
      respond: (req) => (req.url.includes('/_brume/') ? respondOrders(db, req) : respondForm(req)),
    });
    return {
      ...base,
      visit(next, options) {
        if (pathOf(next) !== ORDERS_URL) {
          toast.info(`示範頁面不會離開列表（前往 ${next}）`);
          return;
        }
        base.visit(next, options);
        setUrl(next);
      },
      reload(options) {
        base.reload(options);
        setVersion((v) => v + 1);
      },
    };
  }, [db]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-reads the mutable table
  const page = useMemo(() => buildOrdersPage(url, db), [url, db, version]);
  return { adapter, page };
}

function OrdersGrid({ name, db }: { name: string; db: OrderDb }) {
  const { locale } = useBrume();
  const { accent, menuPosition } = useSettings();
  const { adapter, page } = useOrdersServer(db);
  const registry = useMemo(() => createRegistry({ mode: 'vite', components: { RiskScore } }), []);
  return (
    // Inside a real AppShell (sidebar expanded on desktop), so the grid gets an app's content width.
    <div data-testid={`pg-${name}`}>
      <BrumeProvider adapter={adapter} locale={locale}>
        <AppShell
          appName="Brume"
          menu={MENU}
          homeUrl="/admin"
          currentUrl={ORDERS_URL}
          user={{ name: 'Herb' }}
          breadcrumbs={[{ title: '首頁', url: '/admin' }, { title: '訂單' }]}
          layout={{ menuPosition, accent, sidebarCollapsible: true, breadcrumbs: true }}
          logoutUrl="/admin/logout"
        >
          <RegistryProvider registry={registry}>
            <BrumePageView envelope={{ schemaVersion: SCHEMA_VERSION, page }} />
          </RegistryProvider>
        </AppShell>
      </BrumeProvider>
    </div>
  );
}

/** /#/grid: every display, editor, filter type, selector, scope and action on fake 訂單. */
export function GridPage() {
  const db = useMemo(() => createOrderDb(), []);
  return <OrdersGrid name="grid" db={db} />;
}

/** /#/grid-empty: the same grid with no orders yet. */
export function GridEmptyPage() {
  const db = useMemo(() => createOrderDb(0), []);
  return <OrdersGrid name="grid-empty" db={db} />;
}

function Bare({ name, children }: { name: string; children: ReactNode }) {
  return (
    <main className="pg-page" data-testid={`pg-${name}`}>
      {children}
    </main>
  );
}

/** /#/error-page: a 404 envelope through BrumePageView. */
export function ErrorPagePage() {
  return (
    <Bare name="error-page">
      <BrumePageView
        envelope={{
          schemaVersion: SCHEMA_VERSION,
          page: {
            type: 'error',
            status: 404,
            title: '找不到這個頁面',
            message: '網址可能打錯了，或這個頁面已經移除。',
          },
        }}
      />
    </Bare>
  );
}
