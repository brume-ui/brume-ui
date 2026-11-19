import {
  type BrumeAdapter,
  BrumeProvider,
  Button,
  createMemoryAdapter,
  useBrume,
} from '@brume-ui/brume-react';
import { BrumePageView, createRegistry, RegistryProvider } from '@brume-ui/brume-renderer';
import { SCHEMA_VERSION } from '@brume-ui/brume-schema';
import { useMemo, useState } from 'react';
import { DemoGuide, useDemoExample } from './demo-guide';
import {
  BANNERS_URL,
  buildBannersPage,
  buildMenusPage,
  createBannerDb,
  createMenuDb,
  MENUS_URL,
  respondBannerAction,
  respondBannerReorder,
  respondMenuReorder,
} from './grid-ordering-data';
import { Page } from './page';

const registry = createRegistry({ mode: 'vite' });
const EXAMPLES = [
  { id: 'grid.ordering.list', title: '可拖曳排序的橫幅列表' },
  { id: 'grid.ordering.tree', title: '可拖曳排序的選單樹' },
] as const;

const pathOf = (url: string) => url.split(/[?#]/)[0];

/** One fake server per demo: `visit` re-renders the list for the URL, `reload` re-reads memory. */
function OrderingDemo({ kind }: { kind: 'list' | 'tree' }) {
  const { locale } = useBrume();
  const home = kind === 'list' ? BANNERS_URL : MENUS_URL;
  const banners = useMemo(() => createBannerDb(), []);
  const menus = useMemo(() => createMenuDb(), []);
  const [url, setUrl] = useState(home);
  const [version, setVersion] = useState(0);
  const adapter = useMemo<BrumeAdapter>(() => {
    const base = createMemoryAdapter(home, {
      respond: async (request) => {
        const response = (kind === 'list'
          ? (respondBannerReorder(banners, request) ?? respondBannerAction(banners, request))
          : respondMenuReorder(menus, request)) ?? { status: 404, data: { message: '找不到' } };
        return response;
      },
    });
    return {
      ...base,
      visit(next, options) {
        if (pathOf(next) !== home) return;
        base.visit(next, options);
        setUrl(next);
      },
      reload(options) {
        base.reload(options);
        setVersion((value) => value + 1);
      },
    };
  }, [banners, menus, home, kind]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-reads the mutable memory server
  const page = useMemo(
    () => (kind === 'list' ? buildBannersPage(url, banners) : buildMenusPage(menus)),
    [kind, url, banners, menus, version],
  );
  return (
    <BrumeProvider adapter={adapter} locale={locale}>
      <RegistryProvider registry={registry}>
        <section data-testid="ordering-grid" style={{ minWidth: 0 }}>
          <BrumePageView envelope={{ schemaVersion: SCHEMA_VERSION, page }} />
        </section>
      </RegistryProvider>
    </BrumeProvider>
  );
}

/** /#/grid-ordering: drag-sort a banner list (with pages and a filter) and a two-level menu tree. */
export function GridOrderingPage() {
  const id = useDemoExample(
    EXAMPLES.map((example) => example.id),
    'grid.ordering.list',
  );
  const [resets, setResets] = useState(0);
  return (
    <Page
      name="grid-ordering"
      title="Grid · 拖曳排序"
      lead="列表與樹狀選單以握把拖曳調整順序；資料只在目前頁面記憶體。"
    >
      <label>
        選擇範例{' '}
        <select
          value={id}
          onChange={(event) => {
            window.location.hash = `/grid-ordering?example=${event.target.value}`;
          }}
        >
          {EXAMPLES.map((example) => (
            <option key={example.id} value={example.id}>
              {example.title}
            </option>
          ))}
        </select>
      </label>{' '}
      <Button variant="secondary" onClick={() => setResets((value) => value + 1)}>
        重設資料
      </Button>
      <DemoGuide featureId={id}>
        <OrderingDemo
          key={`${id}-${resets}`}
          kind={id === 'grid.ordering.tree' ? 'tree' : 'list'}
        />
      </DemoGuide>
    </Page>
  );
}
