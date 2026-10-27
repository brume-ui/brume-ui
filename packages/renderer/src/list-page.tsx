import {
  type DataColumn,
  DataTable,
  PageHeader,
  Pagination,
  useBrume,
} from '@herb09638/brume-react';
import type { ListPage } from '@herb09638/brume-schema';
import { useMemo } from 'react';
import { ComponentSlot } from './component-slot';

type Row = ListPage['rows'][number];

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function hrefForPage(currentUrl: string, page: number): string {
  const url = new URL(currentUrl, 'http://x');
  url.searchParams.set('page', String(page));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function ListPageView({ page }: { page: ListPage }) {
  const { adapter, t } = useBrume();
  const columns = useMemo<DataColumn<Row>[]>(
    () =>
      page.columns.map((col) => ({
        key: col.key,
        header: col.label,
        numeric: col.numeric,
        cell:
          col.display?.type === 'component'
            ? (row) => (
                <ComponentSlot ref={col.display as never} context={{ row, column: col.key }} />
              )
            : (row) => formatCell(row[col.key]),
      })),
    [page.columns],
  );
  const { pagination } = page;
  return (
    <div className="br:flex br:flex-col br:gap-4">
      <PageHeader title={page.title} description={page.description} />
      <DataTable
        columns={columns}
        rows={page.rows}
        getRowId={(row) => String(row.id)}
        caption={page.title}
        empty={{
          title: t('renderer.list.emptyTitle'),
          description: t('renderer.list.emptyDescription'),
        }}
      />
      {pagination.lastPage > 1 ? (
        <Pagination
          page={pagination.page}
          lastPage={pagination.lastPage}
          hrefFor={(n) => hrefForPage(adapter.currentUrl(), n)}
          onNavigate={(href) => adapter.visit(href, { preserveScroll: true, preserveState: true })}
        />
      ) : null}
    </div>
  );
}
