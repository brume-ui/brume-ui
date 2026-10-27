import {
  Button,
  type DataColumn,
  DataTable,
  EmptyState,
  Pagination,
  Skeleton,
} from '@brume-ui/brume-react';
import { Inbox, Plus } from 'lucide-react';
import { useState } from 'react';
import { Page, Panel, Section } from './page';

interface Row {
  id: string;
  name: string;
  role: string;
  amount: number;
}

const ROWS: Row[] = [
  { id: '1', name: '王小明', role: '管理員', amount: 12800 },
  { id: '2', name: '林美玲', role: '編輯', amount: 4520 },
  { id: '3', name: '陳志豪', role: '檢視者', amount: 980 },
];

const COLUMNS: DataColumn<Row>[] = [
  { key: 'name', header: '名稱' },
  { key: 'role', header: '角色' },
  {
    key: 'amount',
    header: '金額',
    numeric: true,
    cell: (r) => r.amount.toLocaleString('en-US'),
  },
];

const EMPTY = { title: '還沒有使用者', description: '新增第一位使用者後會顯示在這裡。' };

export function DataTablePage() {
  return (
    <Page name="data-table" title="DataTable" lead="Rows, loading skeleton and empty state.">
      <Section title="rows (numeric column right-aligned, tabular)">
        <DataTable
          caption="使用者（有資料）"
          columns={COLUMNS}
          rows={ROWS}
          getRowId={(r) => r.id}
          empty={EMPTY}
        />
      </Section>
      <Section title="loading">
        <DataTable
          caption="使用者（載入中）"
          columns={COLUMNS}
          rows={[]}
          loading
          getRowId={(r) => r.id}
          empty={EMPTY}
        />
      </Section>
      <Section title="empty">
        <DataTable
          caption="使用者（空狀態）"
          columns={COLUMNS}
          rows={[]}
          getRowId={(r) => r.id}
          empty={{ ...EMPTY, action: <Button iconStart={Plus}>新增使用者</Button> }}
        />
      </Section>
    </Page>
  );
}

export function PaginationPage() {
  const [page, setPage] = useState(4);
  return (
    <Page name="pagination" title="Pagination" lead="Current page uses the accent color.">
      <Section title="interactive (lastPage 12)">
        <Pagination
          page={page}
          lastPage={12}
          hrefFor={(n) => `#/pagination?page=${n}`}
          onNavigate={(href) => setPage(Number(href.split('=')[1]))}
        />
      </Section>
      <Section title="first page">
        <Pagination
          label="分頁（第一頁）"
          page={1}
          lastPage={5}
          hrefFor={(n) => `#/pagination?page=${n}`}
        />
      </Section>
      <Section title="last page">
        <Pagination
          label="分頁（最後一頁）"
          page={5}
          lastPage={5}
          hrefFor={(n) => `#/pagination?page=${n}`}
        />
      </Section>
    </Page>
  );
}

export function EmptyStatePage() {
  return (
    <Page name="empty-state" title="EmptyState">
      <Section title="with icon and action">
        <Panel>
          <EmptyState
            icon={Inbox}
            title="還沒有文章"
            description="建立第一篇文章後會顯示在這裡。"
            action={<Button iconStart={Plus}>新增文章</Button>}
          />
        </Panel>
      </Section>
      <Section title="text only">
        <Panel>
          <EmptyState title="找不到符合條件的資料" description="試著清除篩選條件再搜尋一次。" />
        </Panel>
      </Section>
    </Page>
  );
}

export function SkeletonPage() {
  return (
    <Page name="skeleton" title="Skeleton" lead="Pulse stops under prefers-reduced-motion.">
      <Section title="bars">
        <Panel>
          <div className="pg-stack">
            <Skeleton />
            <div style={{ width: '75%' }}>
              <Skeleton />
            </div>
            <div style={{ width: '50%' }}>
              <Skeleton />
            </div>
          </div>
        </Panel>
      </Section>
    </Page>
  );
}
