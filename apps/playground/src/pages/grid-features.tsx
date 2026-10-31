import {
  type BrumeAdapter,
  BrumeProvider,
  Button,
  createMemoryAdapter,
  useBrume,
} from '@brume-ui/brume-react';
import { BrumePageView, createRegistry, RegistryProvider } from '@brume-ui/brume-renderer';
import { SCHEMA_VERSION } from '@brume-ui/brume-schema';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AddressDisplay, AddressField } from './custom-address';
import { DemoGuide, useDemoExample } from './demo-guide';
import { gridBackendEvidence } from './grid-backend-evidence';
import { ORDERS_URL } from './grid-data';
import { GRID_EXAMPLES } from './grid-feature-data';
import {
  buildFocusedGridPage,
  buildFocusedResourcePage,
  createFocusedOrderDb,
  exportFocusedOrders,
  respondFocusedGrid,
} from './grid-feature-fixtures';
import { Page, Panel } from './page';

const registry = createRegistry({
  mode: 'vite',
  fields: { TaiwanAddress: { component: AddressField, inlineEditable: true } },
  displays: { TaiwanAddress: AddressDisplay },
});
export function GridFeaturesPage() {
  const id = useDemoExample(
    GRID_EXAMPLES.map((example) => example.id),
    'grid.display.badge',
  );
  const example = GRID_EXAMPLES.find((entry) => entry.id === id);
  return (
    <Page
      name="grid-features"
      title="Grid 功能聚焦"
      lead="欄位與輸入採用正式 GridView；資料庫條件另列真實後端情境與證據。"
    >
      <label>
        選擇聚焦範例{' '}
        <select
          value={id}
          onChange={(event) => {
            window.location.hash = `/grid-features?example=${event.target.value}`;
          }}
        >
          {GRID_EXAMPLES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.title}
            </option>
          ))}
        </select>
      </label>
      <DemoGuide featureId={id}>
        {example?.backend ? <BackendGridGuide id={id} /> : <FocusedGrid key={id} id={id} />}
      </DemoGuide>
    </Page>
  );
}
function BackendGridGuide({ id }: { id: string }) {
  const [origin, setOrigin] = useState('');
  const { path, expected, query } = gridBackendEvidence(id);
  const safeOrigin = /^https?:\/\//.test(origin) ? origin.replace(/\/$/, '') : '';
  return (
    <Panel>
      <h2>公開 workbench 資料庫情境</h2>
      <p>
        此頁不執行 PHP 或 SQL。請填入自己啟動的隔離工作台 origin，開啟以下真實 Resource
        路由；列表使用目前工作台的資料。測試使用 FD-001～FD-004
        固定記錄，測試會自行建立與清理資料，並不更動試用資料庫。
      </p>
      <label>
        隔離工作台 origin{' '}
        <input
          type="url"
          placeholder="https://isolated-workbench.example"
          value={origin}
          onChange={(event) => setOrigin(event.target.value)}
        />
      </label>
      <p>
        <code data-testid="grid-backend-path">{path}</code>
      </p>
      {safeOrigin ? (
        <a href={`${safeOrigin}${path}`} target="_blank" rel="noreferrer">
          開啟隔離資料庫範例
        </a>
      ) : null}
      <p>
        <strong>固定 fixture 預期：</strong>
        <span data-testid="grid-backend-expected">{expected}</span>
      </p>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {JSON.stringify(query, null, 2)}
      </pre>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <caption>GridFocusedDemosTest 的固定資料（不是目前工作台資料）</caption>
          <thead>
            <tr>
              <th>貨號</th>
              <th>名稱</th>
              <th>庫存</th>
              <th>分類</th>
              <th>建立時間</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>FD-001</td>
              <td>Ada_50%</td>
              <td>10</td>
              <td>kitchen</td>
              <td>2026-01-05 09:30:59</td>
            </tr>
            <tr>
              <td>FD-002</td>
              <td>ada king</td>
              <td>20</td>
              <td>stationery</td>
              <td>2026-02-14 09:31:00</td>
            </tr>
            <tr>
              <td>FD-003</td>
              <td>Grace</td>
              <td>30</td>
              <td>kitchen</td>
              <td>2026-02-28 23:00:00</td>
            </tr>
            <tr>
              <td>FD-004</td>
              <td>Linus</td>
              <td>40</td>
              <td>textile</td>
              <td>2025-12-31 18:00:00</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        operator 範例使用 filter[demo]；hidden 沒有輸入控制，可在 URL 加 filter[demo]=kitchen 並核對
        chip。完整輸入值與預期 FD 貨號見下列結果測試。query.column-operators
        使用原工作台的欄位標頭篩選。
      </p>
      <ul>
        <li>
          <code>brume-laravel:workbench/app/Http/Controllers/GridShowcaseController.php</code>：公開
          Grid／Filter 宣告。
        </li>
        <li>
          <code>brume-laravel:tests/Feature/GridFocusedDemosTest.php</code>：每種 focused operator
          的實際回應結果。
        </li>
        <li>
          <code>brume-laravel:tests/Feature/Grid/FilterTest.php</code>：陣列
          equal/notEqual、單端／日期／分鐘、callback 隔離、group allowlist、defaults 與欄位映射。
        </li>
        <li>
          <code>brume-laravel:tests/Feature/Grid/FilterDriverTest.php</code>：findInSet、JSON、JSON
          path 的實際 driver 分支。
        </li>
        <li>
          <code>brume-laravel:tests/Feature/Grid/ExportTest.php</code>、<code>QueryTest.php</code>、
          <code>StringKeyTest.php</code>：Excel 原始數值／label／秘密欄位拒絕、排序
          allowlist、字串列身份。
        </li>
      </ul>
      <p>
        SQLite 的 LIKE／LOWER 對 Unicode 大小寫支援有限；LIKE 依 DB/collation，JSON contains 在
        SQLite 是 LIKE fallback，不能代表 MySQL／PostgreSQL 原生 JSON。datetime
        區間含整個結束分鐘，date 含整天。PostgreSQL 非文字 ilike 另有型別限制。本地未驗證
        MySQL／PostgreSQL，也未執行瀏覽器接受測試。
      </p>
    </Panel>
  );
}
function FocusedGrid({ id }: { id: string }) {
  const { locale } = useBrume();
  const db = useMemo(() => createFocusedOrderDb(), []);
  const [url, setUrl] = useState(ORDERS_URL);
  const [version, setVersion] = useState(0);
  const [events, setEvents] = useState<unknown[]>([]);
  const record = useCallback(
    (event: unknown) => setEvents((previous) => [...previous.slice(-19), event]),
    [],
  );
  const adapter = useMemo<BrumeAdapter>(() => {
    const base = createMemoryAdapter(ORDERS_URL, {
      respond: async (request) => {
        const response = await respondFocusedGrid(db, request);
        record({
          method: request.method,
          url: request.url,
          query: request.query,
          body: request.body,
          status: response.status,
        });
        setVersion((value) => value + 1);
        return response;
      },
    });
    return {
      ...base,
      visit(next, options) {
        base.visit(next, options);
        if (base.currentUrl() !== next) return;
        setUrl(next);
        record({ visit: next });
      },
      reload(options) {
        base.reload(options);
        setVersion((value) => value + 1);
        record({ reload: true });
      },
    };
  }, [db, record]);
  useEffect(() => {
    // Grid exports use native <a download> (they deliberately bypass adapter.request).
    // This app-only memory server supplies a real CSV using the exact public export URL.
    const download = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLAnchorElement) || !target.hasAttribute('download')) return;
      const parsed = new URL(target.href, window.location.origin);
      if (parsed.pathname !== `${ORDERS_URL}/export`) return;
      const result = exportFocusedOrders(target.href, db);
      record({
        export: parsed.pathname + parsed.search,
        ids: result.ids,
        filename: result.filename,
      });
      const blob = URL.createObjectURL(new Blob([result.text], { type: 'text/csv;charset=utf-8' }));
      target.href = blob;
      target.download = result.filename;
      setTimeout(() => URL.revokeObjectURL(blob), 10_000);
    };
    document.addEventListener('click', download, true);
    return () => document.removeEventListener('click', download, true);
  }, [db, record]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-reads mutable memory server records
  const grid = useMemo(() => buildFocusedGridPage(id, url, db), [id, url, db, version]);
  const form = buildFocusedResourcePage(url, db);
  return (
    <BrumeProvider adapter={adapter} locale={locale}>
      <RegistryProvider registry={registry}>
        {form ? <Button onClick={() => adapter.visit(ORDERS_URL)}>返回聚焦列表</Button> : null}
        <section data-testid="focused-grid" style={{ minWidth: 0 }}>
          <BrumePageView envelope={{ schemaVersion: SCHEMA_VERSION, page: form ?? grid }} />
        </section>
        <Panel>
          <Button
            onClick={() => {
              adapter.visit(ORDERS_URL);
              adapter.reload();
            }}
          >
            清除篩選與重新載入
          </Button>
          {id === 'grid.behavior.batch-errors' ? (
            <Button
              onClick={() =>
                void adapter.request({
                  method: 'post',
                  url: `${ORDERS_URL}/_brume/actions/mark_shipped`,
                  body: { target: 'batch', ids: [999999] },
                })
              }
            >
              送出範圍外 ID（403）
            </Button>
          ) : null}
          <p data-testid="grid-result-count">
            符合 {grid.pagination.total} 筆；目前列：{grid.rows.map((row) => row.id).join(', ')}
          </p>
          <details open>
            <summary>實際列與格式化值</summary>
            <pre
              style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
              data-testid="grid-rows"
            >
              {JSON.stringify(grid.rows, null, 2)}
            </pre>
          </details>
          <details>
            <summary>記憶體原始記錄</summary>
            <pre
              style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
              data-testid="grid-records"
            >
              {JSON.stringify(db.orders, null, 2)}
            </pre>
          </details>
          <details open>
            <summary>實際請求、導頁與下載證據</summary>
            <pre
              style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
              data-testid="grid-events"
            >
              {JSON.stringify(events, null, 2)}
            </pre>
          </details>
        </Panel>
      </RegistryProvider>
    </BrumeProvider>
  );
}
