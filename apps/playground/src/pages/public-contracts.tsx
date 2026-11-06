import {
  Alert,
  BrumeProvider,
  Button,
  CompactTable,
  createMemoryAdapter,
  Field,
  FieldLayoutContext,
  isSafeHref,
  Link,
  LinkButton,
  ProgressBar,
  Select,
  StaticValue,
  TextInput,
  TreeLabel,
  useBrume,
} from '@brume-ui/brume-react';
import {
  BrumePageView,
  ComponentSlot,
  createRegistry,
  FormView,
  RegistryProvider,
  useFormLoader,
  useFormState,
} from '@brume-ui/brume-renderer';
import {
  emitJsonSchema,
  type FormDef,
  type PageEnvelope,
  parseGridQuery,
  SCHEMA_VERSION,
  serializeGridQuery,
  validateEnvelope,
  withGridQuery,
} from '@brume-ui/brume-schema';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { CLOSURE_EXAMPLES } from './coverage-closure-data';
import { DemoGuide, useDemoExample } from './demo-guide';
import { buildFormPage } from './form-data';
import { buildOrdersPage, createOrderDb } from './grid-data';
import { Page, Panel, Section } from './page';

export function Json({ value, label }: { value: unknown; label: string }) {
  return (
    <section aria-label={label}>
      <pre className="pg-contract-json">{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

function ComponentLab({ id }: { id: string }) {
  const [error, setError] = useState(false);
  const [value, setValue] = useState(25);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<'stacked' | 'horizontal'>('stacked');
  const [name, setName] = useState('臺北');
  if (id === 'react.Alert')
    return (
      <>
        {(['danger', 'warning', 'info', 'success'] as const).map((tone) => (
          <Alert
            key={tone}
            tone={tone}
            title={`訊息 · ${tone}`}
            role={tone === 'danger' ? 'alert' : 'status'}
          >
            {tone === 'danger' && error ? '名稱不得留白。' : '這是可讀取的訊息內容。'}
          </Alert>
        ))}
        <Button onClick={() => setError(!error)}>切換錯誤訊息</Button>
      </>
    );
  if (id === 'react.CompactTable')
    return (
      <CompactTable
        caption="商品內嵌明細"
        columns={[
          { key: 'name', label: '商品' },
          { key: 'quantity', label: '數量' },
          { key: 'amount', label: '金額' },
        ]}
        rows={[
          { name: '茶葉', quantity: 2, amount: '1280.50' },
          { name: '茶杯', quantity: 1, amount: '350.00' },
        ]}
      />
    );
  if (id === 'react.ProgressBar')
    return (
      <>
        <label>
          進度值
          <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
          />
        </label>
        <ProgressBar value={value} max={80} label="完成進度" />
        <output>value={value} / max=80</output>
      </>
    );
  if (id === 'react.TreeLabel')
    return (
      <ul aria-label="商品分類樹">
        {(
          [
            ['服飾', 0],
            ['外套', 1],
            ['羽絨外套', 2],
            ['家居', 0],
          ] as const
        ).map(([name, depth]) => (
          <li key={name}>
            <TreeLabel depth={depth}>
              <Link href={`#/public-contracts?example=react.TreeLabel&category=${name}`}>
                {name}
              </Link>
            </TreeLabel>
          </li>
        ))}
      </ul>
    );
  if (id === 'react.StaticValue')
    return (
      <>
        <dl>
          <dt>日期</dt>
          <dd>
            <StaticValue>2026-11-01</StaticValue>
          </dd>
          <dt>金額</dt>
          <dd>
            <StaticValue>NT$ 1,280.50</StaticValue>
          </dd>
          <dt>多選</dt>
          <dd>
            <StaticValue>臺北、臺中</StaticValue>
          </dd>
        </dl>
        <p>此處傳入的是已格式化 children；格式處理由呼叫端負責。</p>
      </>
    );
  if (id === 'react.LinkButton')
    return (
      <>
        <LinkButton
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="inline-details"
        >
          {open ? '關閉明細' : '開啟明細'}
        </LinkButton>
        <section id="inline-details" aria-label="頁內明細" hidden={!open}>
          茶葉 × 2，NT$ 1,280.50
        </section>
      </>
    );
  return (
    <>
      <label>
        欄位版型
        <select value={layout} onChange={(event) => setLayout(event.target.value as typeof layout)}>
          <option value="stacked">標籤在上</option>
          <option value="horizontal">標籤在左</option>
        </select>
      </label>
      <div className="pg-contract-field">
        <FieldLayoutContext.Provider value={layout}>
          <Field label="地點" description="同一個 Field 隨 context 改變排版。">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        </FieldLayoutContext.Provider>
      </div>
      <a href="#/form-layouts?example=form.layout.horizontal">開啟完整橫向表單</a>
    </>
  );
}

function ProviderProbe({ label, onCall }: { label: string; onCall(): void }) {
  const { adapter, locale, t } = useBrume();
  return (
    <div>
      <p>
        {label}：{locale} / {t('common.cancel')}
      </p>
      <Button
        onClick={async () => {
          await adapter.request({ method: 'get', url: `/${label}` });
          onCall();
        }}
      >
        {label}請求
      </Button>
    </div>
  );
}
function ProviderLab() {
  const [english, setEnglish] = useState(true);
  const [, redraw] = useState(0);
  const outer = useMemo(() => createMemoryAdapter('/outer'), []);
  const inner = useMemo(() => createMemoryAdapter('/inner'), []);
  const show = () => redraw((n) => n + 1);
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={english}
          onChange={(event) => setEnglish(event.target.checked)}
        />
        內層英文
      </label>
      <BrumeProvider adapter={outer} locale="zh-TW">
        <ProviderProbe label="外層" onCall={show} />
        <BrumeProvider adapter={inner} locale={english ? 'en' : 'zh-TW'}>
          <ProviderProbe label="內層" onCall={show} />
        </BrumeProvider>
      </BrumeProvider>
      <Json label="外層記錄" value={outer.calls} />
      <Json label="內層記錄" value={inner.calls} />
    </>
  );
}

function AdapterLab({ links = false }: { links?: boolean }) {
  const blocked = useRef(false);
  const [block, setBlock] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [, redraw] = useState(0);
  const adapter = useMemo(() => {
    const instance = createMemoryAdapter('#/public-contracts', {
      respond: (request) =>
        request.signal?.aborted
          ? { status: 0, data: { message: '已取消' } }
          : { status: 200, data: { echo: request.body ?? null } },
    });
    instance.guardNavigation(() => !blocked.current);
    return instance;
  }, []);
  const refresh = () => redraw((n) => n + 1);
  // This adapter both records and performs the ordinary internal hash navigation.
  const linkAdapter = useMemo(
    () => ({
      ...adapter,
      visit(href: string) {
        adapter.visit(href);
        redraw((n) => n + 1);
        if (adapter.currentUrl() === href) {
          window.history.pushState(null, '', href);
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      },
    }),
    [adapter],
  );
  if (links)
    return (
      <BrumeProvider adapter={linkAdapter}>
        <p>安全檢查在呼叫端執行；Link 是原生 anchor。</p>
        <Link href="#/public-contracts?example=react.Link">記錄本範例導覽</Link>
        <Link href="#/">前往功能目錄</Link>
        <Link href="#/grid-features?example=grid.display.table" variant="button">
          前往內嵌列表
        </Link>
        <p>Ctrl/Cmd 或滑鼠中鍵保留原生新分頁行為；一般點擊會記錄 visit 並到達目錄。</p>
        <Json
          label="連結安全判定"
          value={['#/', 'https://example.com', 'javascript:alert(1)', 'data:text/html,x'].map(
            (href) => ({ href, safe: isSafeHref(href) }),
          )}
        />
        <Json label="導覽記錄" value={adapter.calls} />
      </BrumeProvider>
    );
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={block}
          onChange={(event) => {
            setBlock(event.target.checked);
            blocked.current = event.target.checked;
          }}
        />
        阻擋跨頁 visit
      </label>
      <label>
        <input
          type="checkbox"
          checked={cancel}
          onChange={(event) => setCancel(event.target.checked)}
        />
        取消 request signal
      </label>
      <div className="pg-contract-actions">
        <Button
          onClick={() => {
            adapter.visit(adapter.currentUrl() === '/next' ? '/other' : '/next');
            refresh();
          }}
        >
          visit
        </Button>
        <Button
          onClick={() => {
            adapter.reload({ only: ['envelope'] });
            refresh();
          }}
        >
          reload
        </Button>
        <Button
          onClick={() => {
            adapter.submit('post', '/memory', { name: '草稿' });
            refresh();
          }}
        >
          submit
        </Button>
        <Button
          onClick={async () => {
            const controller = new AbortController();
            if (cancel) controller.abort();
            setResult(
              await adapter.request({
                method: 'post',
                url: '/memory',
                body: { name: '草稿' },
                signal: controller.signal,
              }),
            );
          }}
        >
          request
        </Button>
      </div>
      <output aria-label="目前 URL">{adapter.currentUrl()}</output>
      <Json label="adapter 呼叫記錄" value={adapter.calls} />
      <Json label="request 回應" value={result} />
      <p>
        memory adapter 不包含 confirm；確認框由 useConfirm/ConfirmHost 與呼叫端處理。signal
        是否取消取決於 respond；fetchJson 在網路 adapter 處理 abort。
      </p>
      <a href="#/confirm">開啟真實確認框示範</a>
    </>
  );
}

const apiForm: FormDef = {
  layout: 'stacked',
  nodes: [
    {
      type: 'field',
      field: {
        type: 'text',
        name: 'name',
        label: '名稱',
        required: true,
        rules: [{ rule: 'required', message: '請輸入名稱。' }],
      },
    },
    {
      type: 'field',
      field: {
        type: 'repeater',
        mode: 'json',
        sortable: true,
        name: 'rows',
        label: '明細',
        nodes: [{ type: 'field', field: { type: 'text', name: 'title', label: '明細名稱' } }],
      },
    },
  ],
};
function FormApiLab() {
  const api = useFormState(apiForm, {
    name: '',
    rows: [
      { _brume: { key: 'one' }, title: '茶葉' },
      { _brume: { key: 'two' }, title: '茶杯' },
    ],
  });
  return (
    <>
      <FormView form={apiForm} api={api} />
      <div className="pg-contract-actions">
        <Button onClick={() => api.touch('name')}>touch 名稱</Button>
        <Button onClick={() => api.validateAll()}>驗證全部</Button>
        <Button onClick={() => api.setServerErrors({ name: ['伺服器名稱錯誤。'] })}>
          套用伺服器錯誤
        </Button>
        <Button onClick={() => api.moveRow('rows', 0, 1)}>交換明細</Button>
        <Button onClick={() => api.removeRow('rows', 0)}>移除第一列</Button>
        <Button onClick={() => api.reset()}>重設 API 草稿</Button>
      </div>
      <Json
        label="表單 API 狀態"
        value={{
          values: api.values,
          dirty: api.dirty,
          errors: api.errors,
          resetVersion: api.resetVersion,
        }}
      />
      <a href="#/form-behaviors?example=form.behavior.submit-after-edit">
        FormPageView/useFormSubmit 儲存與完整基準
      </a>
      <a href="#/form-dialog">FormDialog 提交與關閉</a>
    </>
  );
}

function Summary({ message }: { message?: string }) {
  return (
    <Alert tone="info" title="註冊區塊">
      {message}
    </Alert>
  );
}
function EnvelopeLab({ registryOnly = false }: { registryOnly?: boolean }) {
  const [kind, setKind] = useState('dashboard');
  const [mode, setMode] = useState<'vite' | 'precompiled'>('precompiled');
  const [missing, setMissing] = useState(false);
  const registry = useMemo(() => createRegistry({ mode, components: { Summary } }), [mode]);
  const envelope: unknown =
    kind === 'list'
      ? { schemaVersion: SCHEMA_VERSION, page: buildOrdersPage('/admin/orders', createOrderDb()) }
      : kind === 'form'
        ? { schemaVersion: SCHEMA_VERSION, page: buildFormPage() }
        : kind === 'error'
          ? {
              schemaVersion: SCHEMA_VERSION,
              page: {
                type: 'error',
                status: 422,
                title: '範例錯誤',
                message: '可恢復的錯誤內容。',
                action: { label: '回目錄', url: '#/' },
              },
            }
          : kind === 'unknown'
            ? { schemaVersion: SCHEMA_VERSION, page: { type: 'future', title: '未知頁型' } }
            : {
                schemaVersion: kind === 'version' ? '99.0' : SCHEMA_VERSION,
                page: {
                  type: 'dashboard',
                  title: 'Envelope 儀表板',
                  blocks: [
                    { type: 'card', title: '公開卡片', body: '來自 DashboardPage.blocks 的 body' },
                    {
                      type: 'component',
                      name: 'Summary',
                      props: { message: '來自 ComponentRef.props 的內容' },
                    },
                  ],
                },
              };
  const validation = validateEnvelope(envelope);
  const unknownFieldForm: FormDef = {
    layout: 'stacked',
    nodes: [
      {
        type: 'field',
        field: {
          type: 'custom',
          name: 'missing',
          label: '未知欄位',
          component: { type: 'component', name: 'NoSuchField' },
        },
      },
    ],
  };
  const unknownApi = useFormState(unknownFieldForm, {});
  return (
    <>
      <label>
        Registry 模式
        <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
          <option value="precompiled">precompiled</option>
          <option value="vite">vite</option>
        </select>
      </label>
      <RegistryProvider registry={registry}>
        {registryOnly ? (
          <>
            <label>
              <input
                type="checkbox"
                checked={missing}
                onChange={(event) => setMissing(event.target.checked)}
              />
              缺漏元件
            </label>
            <ComponentSlot
              ref={{
                type: 'component',
                name: missing ? 'NoSuchComponent' : 'Summary',
                props: { message: '已註冊元件可見' },
              }}
            />
            <FormView form={unknownFieldForm} api={unknownApi} />
          </>
        ) : (
          <>
            <label>
              Envelope 頁型
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                {['list', 'form', 'dashboard', 'error', 'version', 'unknown'].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            {validation.ok ? (
              <BrumePageView envelope={envelope as PageEnvelope} />
            ) : (
              <Alert tone="danger" title="Envelope 被拒絕">
                {validation.errors.join('\n')}
              </Alert>
            )}
            <Json label="頁面 envelope" value={envelope} />
          </>
        )}
      </RegistryProvider>
      <p>
        schemaVersion 的 major 相容由 BrumePageView 檢查；validateEnvelope 只驗證結構。未知 type
        必須先拒絕，不直接送入 renderer 的 never 分支。
      </p>
    </>
  );
}

function LoaderProbe() {
  const loader = useFormLoader();
  return (
    <>
      <div className="pg-contract-actions">
        <Button onClick={() => loader.load('/form')}>載入表單</Button>
        <Button onClick={() => loader.load('/failure')}>模擬載入失敗</Button>
        <Button onClick={loader.clear}>清除載入</Button>
      </div>
      {loader.error && <Alert tone="danger">{loader.error}</Alert>}
      <output aria-label="載入結果">{loader.page?.title ?? '尚未載入'}</output>
    </>
  );
}
function GridApiLab() {
  const [, redraw] = useState(0);
  const adapter = useMemo(
    () =>
      createMemoryAdapter('/', {
        respond: (request) => {
          queueMicrotask(() => redraw((n) => n + 1));
          return request.url === '/failure'
            ? { status: 422, data: { message: '載入範例失敗。' } }
            : { status: 200, data: { schemaVersion: SCHEMA_VERSION, page: buildFormPage() } };
        },
      }),
    [],
  );
  return (
    <BrumeProvider adapter={adapter}>
      <LoaderProbe />
      <Json label="載入請求" value={adapter.calls} />
      <ul>
        <li>
          <a href="#/grid-features?example=grid.behavior.resource-page">
            ResourceGridView / QuickCreate / useGridNavigation：新增、搜尋、排序與分頁
          </a>
        </li>
        <li>
          <a href="#/grid">ListPageView / GridView：訂單列表</a>
        </li>
      </ul>
      <p>
        useFormLoader：最後一次 load 優先；clear/unmount 使舊回應失效。此例 request 不寫入資料庫。
      </p>
    </BrumeProvider>
  );
}

const initialQuery =
  'page=2&per_page=10&sort=-amount&q=茶&scope=paid&filter[status][]=paid&filter[status][]=open&filter[amount][start]=10&filter[amount][end]=20&filter[name][op]=like&filter[name][value]=茶';
function QueryLab() {
  const [query, setQuery] = useState(initialQuery);
  const parsed = parseGridQuery(query);
  return (
    <>
      <label>
        原始 query
        <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={5} />
      </label>
      <Button onClick={() => setQuery('page=0&per_page=oops&filter[__proto__]=bad&filter=')}>
        載入非法值案例
      </Button>
      <Json label="解析結果" value={parsed} />
      <Json label="重新編碼" value={serializeGridQuery(parsed)} />
      <Json
        label="保留其他參數的 URL"
        value={withGridQuery('/orders?campaign=demo#details', parsed)}
      />
    </>
  );
}
function SchemaLab() {
  const [text, setText] = useState(
    JSON.stringify(
      { schemaVersion: SCHEMA_VERSION, page: { type: 'dashboard', title: '契約', blocks: [] } },
      null,
      2,
    ),
  );
  let result: unknown;
  try {
    result = validateEnvelope(JSON.parse(text));
  } catch {
    result = { ok: false, errors: ['JSON 語法錯誤'] };
  }
  return (
    <>
      <label>
        Envelope JSON
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} />
      </label>
      <Button onClick={() => setText('{"schemaVersion":"0.1","page":{"type":"future"}}')}>
        載入未知頁型
      </Button>
      <Json label="Schema 驗證結果" value={result} />
      <p>
        emitJsonSchema() 實際輸出 {emitJsonSchema().length} 字元，包含 PageEnvelope、SharedProps 與
        HTTP definitions。SharedProps 是 Inertia props.brume；不屬於 PageEnvelope.page。
      </p>
      <p>
        ComponentRef.name 是字串，不是 schema 自動 allowlist。createRegistry/ComponentSlot
        只從明確註冊表取得元件，找不到顯示 MissingComponent。
      </p>
    </>
  );
}
function TokensLab() {
  return (
    <>
      <div className="pg-token-swatches">
        {[
          'text',
          'text-muted',
          'accent',
          'danger',
          'warning',
          'info',
          'success',
          'surface',
          'surface-canvas',
          'border',
        ].map((name) => (
          <div key={name}>
            <span className="pg-token-swatch" style={{ background: `var(--br-${name})` }} />
            <code>--br-{name}</code>
          </div>
        ))}
      </div>
      <h3>4px 空間</h3>
      {[1, 2, 4, 8].map((n) => (
        <div key={n}>
          <span>{n} × 4px</span>
          <span
            aria-hidden="true"
            className="pg-token-space"
            style={{ width: `calc(var(--br-spacing) * ${n})` }}
          />
        </div>
      ))}
      <h3>圓角與陰影</h3>
      <div className="pg-contract-actions">
        {['input', 'card', 'dialog', 'pill'].map((name) => (
          <div
            key={name}
            className="pg-token-box"
            style={{ borderRadius: `var(--br-radius-${name})` }}
          >
            {name}
          </div>
        ))}
      </div>
      <div className="pg-contract-actions">
        {['flat', 'row', 'overlay'].map((name) => (
          <div
            key={name}
            className="pg-token-box"
            style={{ boxShadow: `var(--br-shadow-${name})` }}
          >
            {name}
          </div>
        ))}
      </div>
      <p style={{ fontFamily: 'var(--br-font-sans)' }}>公開字體：繁體中文 Aa 0123</p>
      <Button>用 Tab 核對焦點環</Button>
      <p>
        CSS 由公開 @brume-ui/brume-tokens/tokens.css export 載入。焦點環使用
        --br-focus-ring；動態另見 <a href="#/motion">動效範例</a>。
      </p>
    </>
  );
}
function ProtocolGuide() {
  return (
    <>
      <Json
        label="HTTP 契約案例"
        value={{
          action: { target: 'row', ids: [42], input: { note: '茶葉' } },
          cell: { column: 'amount', value: '1280.50' },
          response: {
            feedback: {
              toast: { type: 'success', message: '已完成' },
              download: { url: '/report.csv', filename: 'report.csv' },
              refresh: true,
              redirect: '/orders',
            },
          },
          validation422: {
            message: '無效輸入',
            errors: { 'images.2.extra.link': ['請填安全網址。'] },
          },
        }}
      />
      <p>
        上方是協定 fixture，沒有發送請求。請使用下方既有互動案例查看實際 memory
        requests、回饋與匯出檔；不宣稱伺服器執行。
      </p>
      <ul>
        {[
          ['grid.behavior.action-input', 'Action 表單與 nested422'],
          ['grid.editor.currency', 'CellUpdate 精確字串'],
          ['grid.behavior.export-memory', '下載與匯出'],
          ['grid.behavior.action-redirect', 'redirect 優先 refresh'],
        ].map(([id, title]) => (
          <li key={id}>
            <a href={`#/grid-features?example=${id}`}>{title}</a>
          </li>
        ))}
      </ul>
      <Json
        label="Unsafe href 拒絕"
        value={{ javascript: isSafeHref('java\tscript:alert(1)'), relative: isSafeHref('/orders') }}
      />
    </>
  );
}
function InertiaGuide() {
  return (
    <>
      <p>
        真實 host：先依 Laravel README 備份與完成 additive
        migration，再由現有登入流程進入。這裡沒有啟動 host 或操作資料。
      </p>
      <ul>
        <li>
          <a href="http://127.0.0.1:8100/admin/components">
            Workbench 元件頁：BrumeLayout、SharedProps、導覽與語系
          </a>
        </li>
        <li>
          <a href="http://127.0.0.1:8100/admin/_demo/toast">
            Workbench 同訊息 toast：重複 flash ID 去重、新 ID 重新顯示
          </a>
        </li>
        <li>
          <a href="http://127.0.0.1:8100/admin/_demo/missing-component">
            Workbench 未註冊 ComponentRef 提示
          </a>
        </li>
      </ul>
      <Json
        label="Host 契約對照"
        value={{
          createBrumeApp:
            '建立 registry，呼叫 createInertiaApp；resolvePage 解析 brume/page、brume/login 或 pages glob；未知名稱拋錯',
          BrumeLayout:
            'useShared 讀 props.brume；注入 adapter/locale/registry、AppShell、ConfirmHost、Toaster',
          formatTitle: '訂單 · Brume；空標題回 appName',
          locale: 'brume_locale cookie；SameSite=Lax、path=/、一年，再 router.reload()',
          flash: '相同 flash id 不重複 toast；新 id 相同 message 仍顯示',
        }}
      />
      <pre className="pg-contract-json">pnpm --filter @brume-ui/brume-inertia test</pre>
      <p>
        精確來源測試：adapter.test.ts（visit/reload/submit/guard）、create-app.test.tsx（registry/resolvePage/bootstrap）、title-lang.test.tsx、locale.test.ts、flash.test.tsx、flash-store.test.ts。這些為實際來源測試，remote
        host/browser 接受驗證仍由 CI 執行。
      </p>
    </>
  );
}

export function PublicContractsPage() {
  const id = useDemoExample(
    CLOSURE_EXAMPLES.map((item) => item.id),
    'react.Alert',
  );
  const example = CLOSURE_EXAMPLES.find((item) => item.id === id) ?? CLOSURE_EXAMPLES[0];
  if (!example) return null;
  let content: ReactNode;
  if (id.startsWith('lifecycle.'))
    content = (
      <>
        <Alert tone="info" title="後端契約證據" role="status">
          此頁不執行資料庫、交易、權威值或檔案清理。下方是實際來源測試的 fixture
          與預期結果，請只在隔離測試環境執行命令。
        </Alert>
        <h3>精確測試</h3>
        <p>{example.testName}</p>
        <pre className="pg-contract-json">{example.command}</pre>
        <a href="http://127.0.0.1:8100/admin/compositions">
          可操作 Workbench：關聯組合、地址映射、精確值、重排與附件
        </a>
        <p>
          Workbench 可儲存並重開；hook veto、foreign id、rollback、過期 token
          等攻擊／失敗情境由測試驗證，沒有提供可破壞 live 資料的按鈕。先依 Laravel README 完成升級。
        </p>
        <p>
          SQLite 已有 Task 5 完整測試證據；MySQL 由遠端 CI 驗證。PostgreSQL 未驗證；memory UI
          不能證明後端交易、鎖定或 cleanup。
        </p>
      </>
    );
  else if (id === 'react.BrumeProvider') content = <ProviderLab />;
  else if (id === 'react.Link') content = <AdapterLab links />;
  else if (id.startsWith('react.')) content = <ComponentLab id={id} />;
  else if (id === 'renderer.form-api') content = <FormApiLab />;
  else if (id === 'renderer.grid-api') content = <GridApiLab />;
  else if (id.startsWith('renderer.'))
    content = <EnvelopeLab registryOnly={id === 'renderer.registry'} />;
  else if (id === 'contract.query') content = <QueryLab />;
  else if (id === 'contract.adapter') content = <AdapterLab />;
  else if (id === 'contract.schema') content = <SchemaLab />;
  else if (id === 'contract.protocol') content = <ProtocolGuide />;
  else if (id === 'contract.inertia') content = <InertiaGuide />;
  else content = <TokensLab />;
  return (
    <DemoGuide featureId={id}>
      <Page
        name="public-contracts"
        className="pg-public-contracts"
        title="公開元件與契約實驗"
        lead="以真實公開 API 操作前端；後端契約以實際來源測試重現。"
      >
        <Field label="聚焦功能">
          <Select
            value={id}
            onValueChange={(value) => {
              window.location.hash = `#/public-contracts?example=${value}`;
            }}
            options={CLOSURE_EXAMPLES.map((item) => ({
              value: item.id,
              label: `${item.id} · ${item.title}`,
            }))}
          />
        </Field>
        <Section title={example.title}>
          <p>
            <strong>輸入／操作：</strong>
            {example.fixture}
          </p>
          <p>
            <strong>可觀察結果：</strong>
            {example.outcome}
          </p>
          <Panel>
            <div className="pg-contract-lab" key={id}>
              {content}
            </div>
          </Panel>
        </Section>
        <Section title="實際來源與驗證">
          <ul>
            {example.evidence.map((source) => {
              const [repo, path] = source.split(':');
              const hash =
                repo === 'brume-ui'
                  ? '308d11f70489109e565d52f4e627fcb25b3c73a5'
                  : 'b44fb4cf0d3c389a1e52bd599ba7a1f486ed244a';
              return (
                <li key={source}>
                  <a href={`https://github.com/brume-ui/${repo}/blob/${hash}/${path}`}>{source}</a>
                </li>
              );
            })}
          </ul>
        </Section>
      </Page>
    </DemoGuide>
  );
}
