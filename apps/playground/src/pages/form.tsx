import { BrumeProvider, Button, createMemoryAdapter, toast, useBrume } from '@brume-ui/brume-react';
import {
  FormDialog,
  FormPageView,
  FormView,
  type FormViewHandle,
  useFormState,
  useFormSubmit,
} from '@brume-ui/brume-renderer';
import { useMemo, useRef, useState } from 'react';
import { buildFormPage, buildStoredFormPage, respondForm } from './form-data';
import { createOrderDb, type OrderDb } from './grid-data';
import { Page, Panel } from './page';

function FormDemo({ kind }: { kind: 'form' | 'form-horizontal' | 'form-page' | 'form-dialog' }) {
  const { locale } = useBrume();
  const db = useMemo(() => {
    const store = createOrderDb();
    // Keep the standalone field showcase's intentional initial fixtures.
    for (const order of store.orders) {
      const values = buildFormPage('stacked', order.id).values;
      order.formValues = values;
      order.note = String(values.note ?? '');
      order.items = [{ name: '示範商品', qty: 1, price: Number(values.total) }];
      order.tags = [];
      order.gift = false;
    }
    return store;
  }, []);
  const [record, setRecord] = useState(42);
  const [version, setVersion] = useState(0);
  const adapter = useMemo(() => {
    const base = createMemoryAdapter('/admin/orders/42/edit', {
      respond: (req) => respondForm(req, db),
    });
    return {
      ...base,
      visit(url: string) {
        const previous = base.calls.length;
        base.visit(url);
        if (base.calls.length > previous) {
          toast.info(`前往 ${url}`);
          const edit = /^\/admin\/orders\/(\d+)\/edit$/.exec(url);
          if (edit) setRecord(Number(edit[1]));
          setVersion((current) => current + 1);
        }
      },
    };
  }, [db]);
  return (
    <BrumeProvider locale={locale} adapter={adapter}>
      <FormContent
        key={kind === 'form-dialog' ? kind : version}
        kind={kind}
        db={db}
        record={record}
        setRecord={setRecord}
        version={version}
      />
    </BrumeProvider>
  );
}
function FormContent({
  kind,
  db,
  record,
  setRecord,
  version,
}: {
  kind: 'form' | 'form-horizontal' | 'form-page' | 'form-dialog';
  db: OrderDb;
  record: number;
  setRecord: (update: number | ((id: number) => number)) => void;
  version: number;
}) {
  const { adapter } = useBrume();
  const [open, setOpen] = useState(false);
  // The modal's opener must survive visits; refresh its stored values without remounting it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: version changes when the mutable demo store is saved.
  const page = useMemo(() => {
    const loaded = buildStoredFormPage(
      db,
      kind === 'form-horizontal' ? 'horizontal' : 'stacked',
      record,
    );
    if (!loaded) throw new Error('Missing demo order');
    return loaded;
  }, [db, kind, record, version]);
  const api = useFormState(page.form, page.values);
  const view = useRef<FormViewHandle>(null);
  const { submit, submitting } = useFormSubmit(page, api, view);
  if (kind === 'form-page')
    return (
      <main className="pg-page" data-testid="pg-form-page">
        <FormPageView page={page} />
      </main>
    );
  return (
    <Page
      name={kind}
      title={
        kind === 'form-dialog'
          ? '表單彈窗'
          : kind === 'form-horizontal'
            ? '表單 · 標籤在左'
            : '表單 · 標籤在上'
      }
      lead="完整欄位、上傳與伺服器驗證。顏色輸入 error 可觸發 422。"
    >
      {kind === 'form-dialog' ? (
        <>
          <Button onClick={() => setOpen(true)}>編輯訂單</Button>
          <FormDialog
            page={page}
            open={open}
            onOpenChange={setOpen}
            onSaved={(result, after) => {
              setOpen(false);
              const target = result.feedback?.redirect ?? result.urls[after];
              if (target) adapter.visit(target);
            }}
            nav={{
              prev: db.orders.some((order) => order.id === record - 1)
                ? () => setRecord(record - 1)
                : undefined,
              next: db.orders.some((order) => order.id === record + 1)
                ? () => setRecord(record + 1)
                : undefined,
            }}
          />
        </>
      ) : (
        <Panel>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit('edit');
            }}
          >
            <FormView ref={view} form={page.form} api={api} uploadUrl={page.uploadUrl} />
            <div className="pg-section">
              <Button type="submit" loading={submitting}>
                儲存
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </Page>
  );
}
export function FormStackedPage() {
  return <FormDemo kind="form" />;
}
export function FormHorizontalPage() {
  return <FormDemo kind="form-horizontal" />;
}
export function FormStandalonePage() {
  return <FormDemo kind="form-page" />;
}
export function FormDialogPage() {
  return <FormDemo kind="form-dialog" />;
}
