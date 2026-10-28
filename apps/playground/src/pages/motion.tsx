import {
  Button,
  Card,
  Checkbox,
  ColorSchemeMenu,
  type DataColumn,
  DataTable,
  Dialog,
  Field,
  Pagination,
  RollingNumber,
  Select,
  TextInput,
  toast,
  useConfirm,
  usePrefersReducedMotion,
} from '@brume-ui/brume-react';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { Page, Panel, Section } from './page';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const ROWS: Row[] = [
  { id: '1', name: '王小明', amount: 12800 },
  { id: '2', name: '林美玲', amount: 4520 },
  { id: '3', name: '陳志豪', amount: 980 },
];

const COLUMNS: DataColumn<Row>[] = [
  { key: 'name', header: '名稱' },
  { key: 'amount', header: '金額', numeric: true, cell: (r) => r.amount.toLocaleString('en-US') },
];

const TASKS = ['預約攝影棚', '寄出報價單', '選定字體'];

function ReducedMotionNote() {
  const reduced = usePrefersReducedMotion();
  return (
    <p className="pg-lead" data-testid="motion-reduced">
      {reduced
        ? '目前系統設定為「減少動態效果」：位移與縮放已關閉，只保留短淡入淡出。'
        : '目前系統允許動態效果。到系統設定開啟「減少動態效果」（macOS：輔助使用 → 顯示），本頁會改為只淡入淡出。'}
    </p>
  );
}

function StatsDemo() {
  const [visits, setVisits] = useState(24182);
  const [rate, setRate] = useState(0.128);
  return (
    <div className="pg-row">
      <Card title="本月造訪">
        <div className="pg-stat">
          <RollingNumber value={visits} />
        </div>
      </Card>
      <Card title="轉換率">
        <div className="pg-stat">
          <RollingNumber value={rate} format={{ style: 'percent', maximumFractionDigits: 1 }} />
        </div>
      </Card>
      <div className="pg-row">
        <Button variant="secondary" onClick={() => setVisits((v) => v + 1)}>
          造訪 +1
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setVisits(Math.round(10000 + Math.random() * 90000));
            setRate(Math.round(Math.random() * 400) / 1000);
          }}
        >
          隨機數字
        </Button>
      </div>
    </div>
  );
}

function ToastDemo() {
  return (
    <div className="pg-row">
      <Button
        variant="secondary"
        onClick={() => {
          toast.success('已上傳 brand-kit.zip。');
          toast.info('王小明加入了專案。');
          toast.error('付款失敗：卡片被拒絕，請換一張卡再試。');
        }}
      >
        送出三則通知
      </Button>
      <Button variant="secondary" onClick={() => toast.info('有 3 筆新資料。')}>
        再一則
      </Button>
    </div>
  );
}

function ControlsDemo() {
  const [done, setDone] = useState<Record<string, boolean>>({ [TASKS[0] as string]: true });
  const [role, setRole] = useState('admin');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  return (
    <div className="pg-grid">
      <div className="pg-stack">
        {TASKS.map((task) => (
          <Checkbox
            key={task}
            label={task}
            checked={done[task] ?? false}
            onCheckedChange={(v) => setDone((d) => ({ ...d, [task]: v }))}
          />
        ))}
      </div>
      <div className="pg-stack">
        <Field label="Email" error={error} description="焦點環會從邊緣淡出；錯誤訊息會落入。">
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="pg-row">
          <Button
            variant="secondary"
            onClick={() => setError(email.includes('@') ? undefined : 'Email 少了 @，補上後再試。')}
          >
            驗證 Email
          </Button>
          <Button
            iconStart={Save}
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            儲存
          </Button>
        </div>
      </div>
      <div className="pg-stack">
        <Field label="角色">
          <Select
            value={role}
            onValueChange={setRole}
            options={[
              { value: 'admin', label: '管理員' },
              { value: 'editor', label: '編輯' },
              { value: 'viewer', label: '檢視者' },
            ]}
          />
        </Field>
        <div className="pg-row">
          <span className="pg-label">色彩模式（圖示漸變、整頁淡換）</span>
          <ColorSchemeMenu />
        </div>
      </div>
    </div>
  );
}

function OverlayDemo() {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  return (
    <div className="pg-row">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        開啟彈窗
      </Button>
      <Button
        variant="danger"
        onClick={() =>
          confirm({ title: '刪除使用者「王小明」？', confirmLabel: '刪除使用者', tone: 'danger' })
        }
      >
        刪除確認
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="編輯使用者"
        size="sm"
        maximizable
        footer={<Button onClick={() => setOpen(false)}>儲存使用者</Button>}
      >
        <p>從 0.96 放大並淡入；關閉比開啟快。</p>
      </Dialog>
    </div>
  );
}

function DataDemo() {
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(3);
  return (
    <div className="pg-stack pg-wide">
      <div className="pg-row">
        <Button
          variant="secondary"
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1200);
          }}
        >
          重新載入
        </Button>
      </div>
      <DataTable
        caption="動效示範表格"
        columns={COLUMNS}
        rows={ROWS}
        loading={loading}
        getRowId={(r) => r.id}
        empty={{ title: '沒有資料', description: '新增後會顯示在這裡。' }}
      />
      <Pagination
        page={page}
        lastPage={8}
        hrefFor={(p) => `#/motion?page=${p}`}
        onNavigate={(href) => setPage(Number(href.split('=')[1]))}
      />
    </div>
  );
}

export function MotionPage() {
  return (
    <Page
      name="motion"
      title="動效"
      lead="柔霧動效：短、從快到慢、不搶戲。每個效果都可以在這裡操作。"
    >
      <ReducedMotionNote />
      <Section title="toast 堆疊（滑到上面展開、向右滑掉、展開時計時暫停）">
        <Panel>
          <ToastDemo />
        </Panel>
      </Section>
      <Section title="滾動數字 RollingNumber">
        <Panel>
          <StatsDemo />
        </Panel>
      </Section>
      <Section title="勾選、輸入、下拉、色彩模式">
        <Panel>
          <ControlsDemo />
        </Panel>
      </Section>
      <Section title="彈窗與確認">
        <Panel>
          <OverlayDemo />
        </Panel>
      </Section>
      <Section title="骨架 → 內容、列 hover、頁碼滑動">
        <Panel>
          <DataDemo />
        </Panel>
      </Section>
      <Section title="側欄（指示條滑動、收合寬度、子選單展開）">
        <Panel>
          <p className="pg-label">
            在 <a href="#/shell">Shell</a> 頁操作：切換選單項目、收合側欄、展開「內容」群組。
          </p>
        </Panel>
      </Section>
    </Page>
  );
}
