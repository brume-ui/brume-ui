import { Button, Dialog, Field, TextInput, toast, useConfirm } from '@herb09638/brume-react';
import { useState } from 'react';
import { Page, Panel, Section } from './page';

export function DialogPage() {
  const [size, setSize] = useState<'sm' | 'md' | 'lg' | null>(null);
  const [dirtyOpen, setDirtyOpen] = useState(false);
  return (
    <Page name="dialog" title="Dialog" lead="Sizes, maximizable, and dirty-close confirmation.">
      <Section title="sizes">
        <Panel>
          <div className="pg-row">
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <Button key={s} variant="secondary" onClick={() => setSize(s)}>
                開啟 {s}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => setDirtyOpen(true)}>
              開啟（有未儲存變更）
            </Button>
          </div>
        </Panel>
      </Section>
      <Dialog
        open={size !== null}
        onOpenChange={(open) => !open && setSize(null)}
        title="編輯使用者"
        description="修改後按「儲存使用者」才會生效。"
        size={size ?? 'md'}
        maximizable
        footer={
          <>
            <Button variant="secondary" onClick={() => setSize(null)}>
              取消
            </Button>
            <Button onClick={() => setSize(null)}>儲存使用者</Button>
          </>
        }
      >
        <Field label="名稱">
          <TextInput defaultValue="王小明" />
        </Field>
      </Dialog>
      <Dialog
        open={dirtyOpen}
        onOpenChange={setDirtyOpen}
        title="有未儲存變更"
        size="sm"
        dirty
        footer={<Button onClick={() => setDirtyOpen(false)}>儲存變更</Button>}
      >
        <p>關閉時會先詢問是否捨棄變更。</p>
      </Dialog>
    </Page>
  );
}

export function ConfirmPage() {
  const confirm = useConfirm();
  const [result, setResult] = useState('尚未操作');
  async function ask(tone: 'default' | 'danger') {
    const ok = await confirm(
      tone === 'danger'
        ? {
            title: '刪除使用者「王小明」？',
            description: '刪除後無法復原。',
            confirmLabel: '刪除使用者',
            tone,
          }
        : { title: '發布這篇文章？', confirmLabel: '發布文章', tone },
    );
    setResult(ok ? '已確認' : '已取消');
  }
  return (
    <Page name="confirm" title="useConfirm" lead="Promise-based confirmation via ConfirmHost.">
      <Section title="tones">
        <Panel>
          <div className="pg-row">
            <Button variant="secondary" onClick={() => ask('default')}>
              一般確認
            </Button>
            <Button variant="danger" onClick={() => ask('danger')}>
              危險確認
            </Button>
            <span data-testid="confirm-result">{result}</span>
          </div>
        </Panel>
      </Section>
    </Page>
  );
}

export function ToastPage() {
  return (
    <Page name="toast" title="toast" lead="Toaster is mounted once at the app root.">
      <Section title="kinds">
        <Panel>
          <div className="pg-row">
            <Button variant="secondary" onClick={() => toast.success('已儲存使用者。')}>
              success
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.error('儲存失敗：網路中斷，請稍後再試。')}
            >
              error
            </Button>
            <Button variant="secondary" onClick={() => toast.info('有 3 筆新資料。')}>
              info
            </Button>
            <Button variant="secondary" onClick={() => toast.warning('密碼將在 3 天後過期。')}>
              warning
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.info('同 id 只會顯示一則。', { id: 'dup' })}
            >
              固定 id
            </Button>
          </div>
        </Panel>
      </Section>
    </Page>
  );
}
