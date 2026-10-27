import {
  AppShell,
  Button,
  Checkbox,
  Dialog,
  Field,
  type Locale,
  Select,
  TextInput,
} from '@brume-ui/brume-react';
import { createRegistry, ListPageView, RegistryProvider } from '@brume-ui/brume-renderer';
import type { ListPage, MenuItem } from '@brume-ui/brume-schema';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSettings } from '../settings';

const MENU: MenuItem[] = [
  { title: '儀表板', icon: 'layout-dashboard', url: '/admin' },
  {
    title: '內容',
    icon: 'file-text',
    children: [
      { title: '使用者', url: '/admin/users' },
      { title: '文章', url: '/admin/posts' },
    ],
  },
  { title: '設定', icon: 'settings', url: '/admin/settings' },
];

const NAMES = ['王小明', '林美玲', '陳志豪', '張雅婷', '李宗翰', '黃詩涵'];
const STATUSES = ['active', 'pending', 'suspended'] as const;

const PAGE: ListPage = {
  type: 'list',
  title: '使用者',
  description: '管理可以登入後台的人員。',
  columns: [
    { key: 'name', label: '名稱' },
    { key: 'email', label: '信箱' },
    { key: 'orders', label: '訂單數', numeric: true },
    { key: 'status', label: '狀態', display: { type: 'component', name: 'StatusBadge' } },
  ],
  rows: Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: NAMES[i % NAMES.length],
    email: `user${i + 1}@example.com`,
    orders: (i + 1) * 137,
    status: STATUSES[i % STATUSES.length],
  })),
  pagination: { page: 2, perPage: 12, total: 96, lastPage: 8 },
};

const STATUS_LABEL = { active: '啟用', pending: '待審核', suspended: '停用' } as const;
const STATUS_COLOR = {
  active: 'var(--br-success)',
  pending: 'var(--br-warning)',
  suspended: 'var(--br-danger)',
} as const;

function StatusBadge({ context }: { context?: { row: { status: keyof typeof STATUS_LABEL } } }) {
  const status = context?.row.status ?? 'pending';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 'var(--br-radius-pill)',
        background: 'var(--br-accent-tint)',
        color: 'var(--br-text)',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_COLOR[status] }}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

const ROLES = [
  { value: 'admin', label: '管理員' },
  { value: 'editor', label: '編輯' },
];

export function ShellPage({ onLocaleChange }: { onLocaleChange(locale: Locale): void }) {
  const { accent, menuPosition } = useSettings();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | undefined>('editor');
  const [notify, setNotify] = useState(true);
  const registry = useMemo(() => createRegistry({ mode: 'vite', components: { StatusBadge } }), []);

  return (
    <div data-testid="pg-shell">
      <AppShell
        appName="Brume"
        menu={MENU}
        homeUrl="/admin"
        currentUrl="/admin/users"
        user={{ name: 'Herb' }}
        breadcrumbs={[{ title: '首頁', url: '/admin' }, { title: '使用者' }]}
        layout={{ menuPosition, accent, sidebarCollapsible: true, breadcrumbs: true }}
        logoutUrl="/admin/logout"
        onLocaleChange={onLocaleChange}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Button iconStart={Plus} onClick={() => setOpen(true)}>
              新增使用者
            </Button>
          </div>
          <RegistryProvider registry={registry}>
            <ListPageView page={PAGE} />
          </RegistryProvider>
        </div>
      </AppShell>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="新增使用者"
        description="建立後會寄出邀請信。"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={() => setOpen(false)}>建立使用者</Button>
          </>
        }
      >
        <div className="pg-stack" style={{ maxWidth: 'none' }}>
          <Field label="名稱" required>
            <TextInput placeholder="例如：王小明" />
          </Field>
          <Field label="角色">
            <Select options={ROLES} value={role} onValueChange={setRole} />
          </Field>
          <Checkbox checked={notify} onCheckedChange={setNotify} label="寄出邀請信" />
        </div>
      </Dialog>
    </div>
  );
}
