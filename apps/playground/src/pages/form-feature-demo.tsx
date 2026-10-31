import { BrumeProvider, Button, useBrume } from '@brume-ui/brume-react';
import {
  FormView,
  type FormViewHandle,
  RegistryProvider,
  useFormState,
  useFormSubmit,
} from '@brume-ui/brume-renderer';
import type { AfterSave, FormPage } from '@brume-ui/brume-schema';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { addressRegistry } from './custom-address';
import { DemoGuide, useDemoExample } from './demo-guide';
import { keepFormActionStable } from './form-action-focus';
import { FORM_EXAMPLES } from './form-feature-data';
import { buildFocusedFixture } from './form-feature-fixtures';
import { createFocusedAdapter, type Reply, type Store } from './form-feature-memory';
import { Page, Panel } from './page';

export function FocusedFormRoute({
  route,
}: {
  route: 'form-fields' | 'form-layouts' | 'form-behaviors';
}) {
  const examples = FORM_EXAMPLES.filter((x) => x.route === route);
  const id = useDemoExample(
    examples.map((x) => x.id),
    examples[0]?.id ?? 'form.field.text',
  );
  return (
    <Page
      name={route}
      title={
        { 'form-fields': '表單欄位', 'form-layouts': '表單版型', 'form-behaviors': '表單行為' }[
          route
        ]
      }
      lead="所有回應來自本頁記憶體。重新整理或離開後重置。"
    >
      <label>
        選擇聚焦範例{' '}
        <select
          value={id}
          onChange={(event) => {
            window.location.hash = `/${route}?example=${event.target.value}`;
          }}
        >
          {examples.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
        </select>
      </label>
      <DemoGuide featureId={id}>
        <FocusedFormDemo key={id} exampleId={id} />
      </DemoGuide>
    </Page>
  );
}

export function FocusedFormDemo({ exampleId }: { exampleId: string }) {
  const { locale } = useBrume();
  const fixture = useMemo(() => buildFocusedFixture(exampleId), [exampleId]);
  const [reply, setReply] = useState<Reply>('success');
  const [slow, setSlow] = useState(false);
  const [uploadFailure, setUploadFailure] = useState(false);
  const controls = useRef({ reply, slow, uploadFailure });
  controls.current = { reply, slow, uploadFailure };
  const store = useRef<Store>({
    saved: {},
    wire: {},
    requests: 0,
    uploads: 0,
    aborted: 0,
    hydrateBatches: [],
    pendingOptions: 0,
    currentId: '42',
    nextId: 43,
    revision: 0,
    listeners: new Set(),
  });
  const adapter = useMemo(
    () =>
      createFocusedAdapter(exampleId, fixture, controls, store, () => {
        store.current.revision++;
        for (const notify of store.current.listeners) notify();
      }),
    [exampleId, fixture],
  );
  return (
    <BrumeProvider locale={locale} adapter={adapter}>
      <RegistryProvider registry={addressRegistry}>
        <FocusedContent
          fixture={fixture}
          exampleId={exampleId}
          store={store.current}
          reply={reply}
          setReply={setReply}
          slow={slow}
          setSlow={setSlow}
          uploadFailure={uploadFailure}
          setUploadFailure={setUploadFailure}
        />
      </RegistryProvider>
    </BrumeProvider>
  );
}
const afterLabels: Record<AfterSave, string> = {
  list: '儲存後返回列表',
  edit: '儲存後繼續編輯',
  create: '儲存後新增',
  view: '儲存後檢視',
};
function FocusedContent({
  fixture,
  exampleId,
  store,
  reply,
  setReply,
  slow,
  setSlow,
  uploadFailure,
  setUploadFailure,
}: {
  fixture: ReturnType<typeof buildFocusedFixture>;
  exampleId: string;
  store: Store;
  reply: Reply;
  setReply: (value: Reply) => void;
  slow: boolean;
  setSlow: (value: boolean) => void;
  uploadFailure: boolean;
  setUploadFailure: (value: boolean) => void;
}) {
  const { adapter } = useBrume();
  const api = useFormState(fixture.form, fixture.values);
  const view = useRef<FormViewHandle>(null);
  const [target, setTarget] = useState<AfterSave>('edit');
  const page: FormPage = {
    type: 'form',
    title: '聚焦表單',
    name: '示範',
    formId: exampleId,
    mode: target === 'create' ? 'create' : 'edit',
    ...(target === 'create' ? {} : { record: { id: store.currentId } }),
    form: fixture.form,
    values: fixture.values,
    submit: {
      method: target === 'create' ? 'post' : 'put',
      url: '/demo/focused/save',
      label: '儲存',
    },
    after: { options: ['list', 'edit', 'create', 'view'], default: 'edit' },
    presentation: 'page',
    size: 'lg',
    uploadUrl: '/demo/focused/upload',
  };
  const { submit, submitting } = useFormSubmit(page, api, view);
  const [message, setMessage] = useState('尚未儲存');
  const confirmed = useRef(fixture.values);
  const saving = useRef(false);
  const [synchronizing, setSynchronizing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = useRef(api);
  current.current = api;
  const failedFocus = useRef<{ element: HTMLElement; stateId: typeof api.stateId } | null>(null);
  useLayoutEffect(() => {
    if (submitting || synchronizing) return;
    const focus = failedFocus.current;
    failedFocus.current = null;
    if (
      focus &&
      mounted.current &&
      current.current.stateId === focus.stateId &&
      focus.element.isConnected &&
      (document.activeElement === document.body || document.activeElement === focus.element)
    )
      focus.element.focus();
  }, [submitting, synchronizing]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Seed one unknown owner once per mounted demo, without overwriting later edits.
  useEffect(() => {
    if (exampleId.startsWith('relation.') && exampleId !== 'relation.picker-large-selection')
      api.setValue('selection', [{ id: '1', note: '既有商品草稿', locked: '草稿不能當權威' }]);
  }, []);

  async function save(after: AfterSave) {
    if (saving.current) return;
    saving.current = true;
    failedFocus.current = null;
    setSynchronizing(true);
    setMessage('儲存中…');
    const draft = api.values;
    const state = api.stateId;
    const previousFocus = document.activeElement;
    try {
      const result = await submit(after);
      if (!result && previousFocus instanceof HTMLElement)
        failedFocus.current = { element: previousFocus, stateId: state };
      if (
        !result ||
        !mounted.current ||
        current.current.stateId !== state ||
        current.current.values !== draft
      ) {
        if (mounted.current && current.current.stateId === state)
          setMessage('未完成儲存同步；保留目前草稿。');
        return;
      }
      const version = api.resetVersion;
      setMessage('已儲存，正在載入完整基準…');
      const loaded = await adapter.request<Record<string, unknown>>({
        method: 'get',
        url: '/demo/focused/stored',
      });
      if (!mounted.current || current.current.stateId !== state || api.resetVersion !== version)
        return;
      if (loaded.status !== 200) throw new Error('Canonical snapshot unavailable');
      confirmed.current = after === 'create' ? { name: '' } : loaded.data;
      if (current.current.values !== draft) {
        // A requested new form is not the baseline of a newer edit in the current owner.
        confirmed.current = loaded.data;
        setMessage('已確認儲存基準；保留較新的草稿。');
        return;
      }
      api.reset(confirmed.current);
      setTarget(after);
      adapter.visit(result.urls[after] ?? '/demo/focused/edit');
      setMessage('已儲存並載入完整基準');
    } catch {
      if (mounted.current && current.current.stateId === state)
        setMessage('已儲存，但無法載入完整基準；重設將回到上次確認資料。');
    } finally {
      saving.current = false;
      if (mounted.current) setSynchronizing(false);
    }
  }
  return (
    <>
      <Panel>
        <p>
          這裡展示瀏覽器草稿與模擬端點。wire
          是整份草稿，停用／唯讀不會從請求移除；模擬接受值只在指定案例示範基準保留，不代表後端授權或附件清理。後端資料庫生命週期請依工作台與契約驗證：`/admin/compositions`
          的級距／門檻／贈品附件，對應
          NestedUploadTest。可見欄位顯示原始草稿；條件使用的權威值另列於對照。
        </p>
        <label>
          模擬回應{' '}
          <select value={reply} onChange={(e) => setReply(e.target.value as Reply)}>
            <option value="success">成功</option>
            <option value="server422">422 欄位錯誤</option>
            <option value="cancel">取消</option>
            <option value="network">網路中斷</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} />
          慢速請求（1.4 秒；可觀察進度／重複送出／遲到回應）
        </label>
        {exampleId.startsWith('upload.') ||
        exampleId === 'form.field.upload' ||
        exampleId === 'form.rule.maxFiles' ? (
          <label>
            <input
              type="checkbox"
              checked={uploadFailure}
              onChange={(e) => setUploadFailure(e.target.checked)}
            />
            模擬上傳失敗
          </label>
        ) : null}
      </Panel>
      {target === 'list' || target === 'view' ? (
        <Panel>
          <section data-testid={`memory-${target}`}>
            <h2>{target === 'list' ? '記憶體列表' : '記憶體檢視'}</h2>
            {target === 'list' ? (
              <table>
                <caption>已儲存記錄</caption>
                <thead>
                  <tr>
                    <th>編號</th>
                    <th>名稱</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{store.currentId}</td>
                    <td>{String(store.saved.name ?? '示範記錄')}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p>{String(store.saved.name ?? '示範記錄')}</p>
            )}
            <Button
              onClick={() => {
                confirmed.current = structuredClone(store.saved);
                api.reset(confirmed.current);
                setTarget('edit');
              }}
            >
              編輯記錄
            </Button>
            <Button
              onClick={() => {
                confirmed.current = { name: '' };
                api.reset(confirmed.current);
                setTarget('create');
              }}
            >
              新增記錄
            </Button>
          </section>
        </Panel>
      ) : (
        <Panel>
          {target === 'create' ? <h2 data-testid="memory-create">空白新表單</h2> : null}
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save('edit');
            }}
          >
            <FormView ref={view} form={fixture.form} api={api} uploadUrl="/demo/focused/upload" />
            <div className="pg-section">
              {(['edit', 'list', 'create', 'view'] as const).map((after) => (
                <Button
                  key={after}
                  type="button"
                  disabled={submitting || synchronizing}
                  onMouseDown={keepFormActionStable}
                  onClick={() => void save(after)}
                >
                  {afterLabels[after]}
                </Button>
              ))}
            </div>
          </form>
          <Button
            disabled={submitting || synchronizing}
            onClick={() => {
              api.reset(structuredClone(confirmed.current));
              setMessage('已重設示範草稿');
            }}
          >
            重設示範資料
          </Button>
          {exampleId.includes('condition') || exampleId === 'form.behavior.enable-when' ? (
            <Button
              onClick={() => {
                api.setValue('type', 'invalid');
                api.setValue('requiredCoupon', '');
              }}
            >
              載入無效控制值
            </Button>
          ) : null}
          {exampleId.includes('custom') ? (
            <Button
              onClick={() =>
                api.setServerErrors({
                  'address.county': ['請修正根層縣市。'],
                  'rows.0.address.county': ['請修正列內縣市。'],
                })
              }
            >
              載入地址錯誤
            </Button>
          ) : null}
          {exampleId === 'relation.picker-large-selection' ? (
            <Button
              disabled={submitting || synchronizing}
              onClick={() => {
                confirmed.current = structuredClone(fixture.values);
                api.reset(confirmed.current);
              }}
            >
              載入101項已選商品
            </Button>
          ) : null}
        </Panel>
      )}
      <EvidencePanel api={api} store={store} exampleId={exampleId} message={message} />
    </>
  );
}
function Evidence({ label, id, value }: { label: string; id: string; value: unknown }) {
  return (
    <details open>
      <summary>{label}</summary>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        <output data-testid={id}>{JSON.stringify(value, null, 2)}</output>
      </pre>
    </details>
  );
}

/** Request observers subscribe below the Form owner so hydration never recreates FormApi. */
function EvidencePanel({
  api,
  store,
  exampleId,
  message,
}: {
  api: ReturnType<typeof useFormState>;
  store: Store;
  exampleId: string;
  message: string;
}) {
  useSyncExternalStore(
    (notify) => {
      store.listeners.add(notify);
      return () => {
        store.listeners.delete(notify);
      };
    },
    () => store.revision,
    () => store.revision,
  );
  return (
    <Panel>
      <p role="status">{store.feedback ?? message}</p>
      <p data-testid="form-dirty">{api.dirty ? '有未儲存變更' : '無未儲存變更'}</p>
      <p data-testid="request-count">
        儲存請求：{store.requests}；上傳：{store.uploads}；取消：{store.aborted}；hydrate 批次：
        {store.hydrateBatches.join(', ')}
      </p>
      <p data-testid="options-pending">選項請求中：{store.pendingOptions}</p>
      {exampleId === 'form.behavior.default-value' ? (
        <Evidence
          label="條件採用的列權威值（切換啟用對照）"
          id="form-default-effective"
          value={api.getEffectiveValue('rows')}
        />
      ) : null}
      {exampleId.startsWith('relation.') ? (
        <Evidence
          label="已載入權威對照"
          id="form-effective"
          value={{
            firstReadOnly: api.getField(
              exampleId === 'relation.picker-large-selection'
                ? 'selection.0.locked'
                : 'selection.0.note',
            )?.readOnly,
            lastLocked: api.getEffectiveValue(
              `selection.${Array.isArray(api.values.selection) ? api.values.selection.length - 1 : 0}.locked`,
            ),
          }}
        />
      ) : null}
      <Evidence label="目前草稿" id="form-draft" value={api.values} />
      <Evidence label="實際請求值（完整草稿）" id="form-wire" value={store.wire} />
      <Evidence label="記憶體接受值" id="form-saved" value={store.saved} />
    </Panel>
  );
}
