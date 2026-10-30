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
import { buildFormPage, respondForm } from './form-data';
import { Page, Panel } from './page';

function FormDemo({ kind }: { kind: 'form' | 'form-horizontal' | 'form-page' | 'form-dialog' }) {
  const { locale } = useBrume();
  const adapter = useMemo(() => {
    const base = createMemoryAdapter('/admin/orders/42/edit', { respond: respondForm });
    return {
      ...base,
      visit(url: string) {
        const previous = base.calls.length;
        base.visit(url);
        if (base.calls.length > previous) toast.info(`前往 ${url}`);
      },
    };
  }, []);
  return (
    <BrumeProvider locale={locale} adapter={adapter}>
      <FormContent kind={kind} />
    </BrumeProvider>
  );
}
function FormContent({ kind }: { kind: 'form' | 'form-horizontal' | 'form-page' | 'form-dialog' }) {
  const { adapter } = useBrume();
  const [record, setRecord] = useState(42);
  const [open, setOpen] = useState(false);
  const page = useMemo(
    () => buildFormPage(kind === 'form-horizontal' ? 'horizontal' : 'stacked', record),
    [kind, record],
  );
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
            nav={{ prev: () => setRecord((id) => id - 1), next: () => setRecord((id) => id + 1) }}
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
