import {
  ActionMenu,
  Button,
  Chip,
  Dialog,
  Field,
  type MenuAction,
  Popover,
  RowContextMenu,
  Switch,
  TextInput,
  toast,
  useConfirm,
} from '@brume-ui/brume-react';
import { Copy, Eye, Filter, Pencil, Trash2 } from 'lucide-react';
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

const ROW_NAMES = ['保濕修護洗髮精 500ml', '頭皮淨化精華 30ml', '強韌防落洗髮露'] as const;

function rowActions(name: string, log: (s: string) => void): MenuAction[] {
  return [
    {
      key: 'edit',
      label: '編輯',
      icon: Pencil,
      shortcut: 'E',
      onSelect: () => log(`編輯 ${name}`),
    },
    {
      key: 'copy',
      label: '複製一份',
      icon: Copy,
      shortcut: 'D',
      onSelect: () => log(`複製 ${name}`),
    },
    {
      key: 'view',
      label: '查看詳情',
      icon: Eye,
      shortcut: 'Enter',
      onSelect: () => log(`查看 ${name}`),
    },
    {
      key: 'delete',
      label: '刪除',
      icon: Trash2,
      shortcut: 'Delete',
      tone: 'danger',
      onSelect: () => log(`刪除 ${name}`),
    },
  ];
}

export function MenusPage() {
  const [last, setLast] = useState('尚未操作');
  const [on, setOn] = useState<Record<string, boolean>>({ [ROW_NAMES[0]]: true });
  const [pending, setPending] = useState<string | null>(null);
  const [chips, setChips] = useState([
    { key: 'status', label: '狀態', value: '上架' },
    { key: 'category', label: '分類', value: '洗髮' },
  ]);
  function toggle(name: string, v: boolean) {
    setPending(name);
    setTimeout(() => {
      setOn((o) => ({ ...o, [name]: v }));
      setPending(null);
    }, 800);
  }
  return (
    <Page
      name="menus"
      title="Menus"
      lead="ActionMenu (⋯), RowContextMenu (right-click a row), Popover, Switch and Chip."
    >
      <Section title="row actions (B＋C)">
        <Panel>
          <div className="pg-stack">
            {ROW_NAMES.map((name) => (
              <RowContextMenu key={name} items={rowActions(name, setLast)}>
                <div className="pg-row" style={{ justifyContent: 'space-between' }}>
                  <span>{name}</span>
                  <span className="pg-row">
                    <Switch
                      label={`${name} 上架`}
                      checked={on[name] ?? false}
                      pending={pending === name}
                      onCheckedChange={(v) => toggle(name, v)}
                    />
                    <ActionMenu label={`${name} 的更多操作`} items={rowActions(name, setLast)} />
                  </span>
                </div>
              </RowContextMenu>
            ))}
            <span data-testid="menu-result">{last}</span>
          </div>
        </Panel>
      </Section>
      <Section title="popover + chips">
        <Panel>
          <div className="pg-row">
            <Popover
              trigger={
                <Button variant="secondary" iconStart={Filter}>
                  篩選
                </Button>
              }
              title="篩選條件"
            >
              <Field label="名稱">
                <TextInput />
              </Field>
            </Popover>
            {chips.map((c) => (
              <Chip
                key={c.key}
                label={c.label}
                value={c.value}
                removeLabel={`移除篩選：${c.label}`}
                onRemove={() => setChips((all) => all.filter((x) => x.key !== c.key))}
              />
            ))}
          </div>
        </Panel>
      </Section>
    </Page>
  );
}
