import { beforeEach, describe, expect, it } from 'vitest';
import { buildFormPage, respondForm } from './form-data';
import { buildOrdersPage, createOrderDb } from './grid-data';

describe('playground form server', () => {
  let db = createOrderDb();
  beforeEach(() => {
    db = createOrderDb();
  });
  it('serves the full fixture and four page sections with fresh independent values', () => {
    const first = buildFormPage();
    const second = buildFormPage('horizontal');
    expect(first.form.layout).toBe('stacked');
    expect(second.form.layout).toBe('horizontal');
    expect(first.form.nodes.filter((node) => node.type === 'section')).toHaveLength(4);
    first.values.title = 'changed';
    expect(second.values.title).toBe('春季訂單');
  });
  it('loads records, rejects a server-only error, and accepts a corrected submit', async () => {
    const loaded = await respondForm({ method: 'get', url: '/admin/orders/43/edit' }, db);
    expect(loaded.status).toBe(200);
    expect(loaded.data).toMatchObject({ page: { record: { id: 43 } } });
    const rejected = await respondForm(
      {
        method: 'put',
        url: '/admin/orders/42',
        body: { values: { color: 'error', meta: { color: 'error' } }, after: 'edit' },
      },
      db,
    );
    expect(rejected).toMatchObject({
      status: 422,
      data: { errors: { 'meta.color': ['這個顏色目前無法供應。'] } },
    });
    const saved = await respondForm(
      {
        method: 'put',
        url: '/admin/orders/42',
        body: { values: { title: '春季訂單', meta: { color: 'blue' } }, after: 'edit' },
      },
      db,
    );
    expect(saved).toMatchObject({
      status: 200,
      data: { id: 42, feedback: { toast: { message: '已儲存變更' } } },
    });
  });
  it('returns upload metadata from multipart files and rejects unknown endpoints', async () => {
    const body = new FormData();
    body.set('file', new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    const uploaded = await respondForm({ method: 'post', url: '/admin/orders/upload', body }, db);
    expect(uploaded).toMatchObject({ status: 200, data: { name: 'notes.txt', size: 5 } });
    expect((await respondForm({ method: 'get', url: '/unknown' }, db)).status).toBe(404);
  });
});

it('shares create edit quick-create and reload state within one demo with unique IDs', async () => {
  const db = createOrderDb(0);
  const other = createOrderDb(0);
  const save = (values: Record<string, unknown>) =>
    respondForm({ method: 'post', url: '/admin/orders', body: { values, after: 'list' } }, db);
  const first = await save({
    customer: '第一位',
    title: '新訂單',
    note: '配送備註',
    promo: { start: '2026-01-01' },
  });
  const second = await save({ customer: '第二位', title: '另一訂單' });
  const firstId = (first.data as { id: number }).id;
  const secondId = (second.data as { id: number }).id;
  expect(firstId).not.toBe(secondId);
  expect(buildOrdersPage('/admin/orders', db).rows.map((row) => row.customer)).toEqual(
    expect.arrayContaining(['第一位', '第二位']),
  );
  expect(buildOrdersPage('/admin/orders', other).rows).toHaveLength(0);
  const edited = await respondForm(
    {
      method: 'put',
      url: `/admin/orders/${firstId}`,
      body: {
        values: {
          customer: '已編輯',
          title: '保留標題',
          note: '修改備註',
          promo: {},
          meta: { color: 'teal' },
        },
        after: 'edit',
      },
    },
    db,
  );
  expect(edited.status).toBe(200);
  const reopened = await respondForm({ method: 'get', url: `/admin/orders/${firstId}/edit` }, db);
  expect(reopened.data).toMatchObject({
    page: {
      values: {
        customer: '已編輯',
        title: '保留標題',
        note: '修改備註',
        promo: {},
        meta: { color: 'teal' },
      },
    },
  });
  const quick = await save({ customer: '快速客戶' });
  expect((quick.data as { id: number }).id).not.toBe(secondId);
  expect(buildOrdersPage('/admin/orders', db).rows.map((row) => row.customer)).toEqual(
    expect.arrayContaining(['已編輯', '第二位', '快速客戶']),
  );
  expect((await respondForm({ method: 'get', url: '/admin/orders/9999/edit' }, db)).status).toBe(
    404,
  );
  expect(
    (
      await respondForm(
        { method: 'put', url: '/admin/orders/9999', body: { values: { title: '不存在' } } },
        db,
      )
    ).status,
  ).toBe(404);
});
