import { describe, expect, it } from 'vitest';
import { ORDERS_URL } from './grid-data';
import { buildFocusedGridPage, createFocusedOrderDb } from './grid-feature-fixtures';

describe('focused Grid fixtures', () => {
  it.each([
    ['badge', 'channel'],
    ['link', 'service'],
    ['limit', 'note'],
    ['progress', 'progress'],
    ['qrcode', 'pickup'],
    ['copyable', 'tracking'],
    ['downloadable', 'invoice'],
    ['expand', 'detail'],
    ['modal', 'log'],
    ['table', 'items'],
  ])('makes %s immediately visible with useful data', (type, key) => {
    const page = buildFocusedGridPage(`grid.display.${type}`, ORDERS_URL, createFocusedOrderDb());
    expect(page.columns.find((column) => column.key === key)?.hiddenByDefault).not.toBe(true);
    expect(page.columns.length).toBeLessThanOrEqual(5);
    expect(page.rows[0]?.[key]).toBeTruthy();
  });
  it.each(['custom', 'textarea', 'radio', 'checkbox', 'switchGroup', 'date', 'currency', 'tags'])(
    'exposes %s editors initially',
    (type) => {
      const page = buildFocusedGridPage(`grid.editor.${type}`, ORDERS_URL, createFocusedOrderDb());
      expect(
        page.columns.some((column) => column.editor?.type === type && !column.hiddenByDefault),
      ).toBe(true);
    },
  );
});

import { DisplaySchema, InlineEditorSchema } from '@brume-ui/brume-schema';
import { GRID_EXAMPLES } from './grid-feature-data';
import {
  buildFocusedResourcePage,
  exportFocusedOrders,
  FOCUSED_INPUTS,
  respondFocusedGrid,
} from './grid-feature-fixtures';

const focusUrl = (value: unknown): string => {
  const params = new URLSearchParams();
  if (Array.isArray(value)) for (const item of value) params.append('filter[focus][]', item);
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value))
      params.set(`filter[focus][${key}]`, String(item));
  else params.set('filter[focus]', String(value));
  return `${ORDERS_URL}?${params}`;
};
const idsFor = (input: string, value: unknown) =>
  buildFocusedGridPage(`grid.input.${input}`, focusUrl(value), createFocusedOrderDb())
    .rows.map((row) => row.id)
    .sort((a, b) => Number(a) - Number(b));

it('directly targets every public display and editor family without hiding it', () => {
  const types = (schema: unknown): string[] => {
    const def = schema as {
      anyOf?: unknown[];
      properties?: { type?: { const?: string; anyOf?: { const: string }[] } };
    };
    return (
      def.anyOf?.flatMap(types) ??
      def.properties?.type?.anyOf?.map((item) => item.const) ??
      (def.properties?.type?.const ? [def.properties.type.const] : [])
    );
  };
  for (const [prefix, schema] of [
    ['display', DisplaySchema],
    ['editor', InlineEditorSchema],
  ] as const) {
    for (const type of types(schema)) {
      const id = `grid.${prefix}.${type}`;
      expect(GRID_EXAMPLES.some((example) => example.id === id)).toBe(true);
      const page = buildFocusedGridPage(id, ORDERS_URL, createFocusedOrderDb());
      expect(
        page.columns.some(
          (column) =>
            (prefix === 'display' ? (column.display?.type ?? 'text') : column.editor?.type) ===
              type && !column.hiddenByDefault,
        ),
      ).toBe(true);
    }
  }
});

it('applies text ranges at both ends and at either individual end, then clears', () => {
  expect(idsFor('range-text', { start: 'ORD-2610010', end: 'ORD-2610015' })).toEqual([
    10, 11, 12, 13, 14, 15,
  ]);
  expect(idsFor('range-text', { start: 'ORD-2610023' })).toEqual([23, 24]);
  expect(idsFor('range-text', { end: 'ORD-2610002' })).toEqual([1, 2]);
  expect(
    buildFocusedGridPage('grid.input.range-text', ORDERS_URL, createFocusedOrderDb()).pagination
      .total,
  ).toBe(24);
});
it('applies datetime minute equality and inclusive ending minutes independently of date', () => {
  expect(idsFor('date-time', '2026-10-28T09:30')).toEqual([6, 12, 18, 24]);
  expect(idsFor('range-datetime', { start: '2026-10-28T09:30', end: '2026-10-28T09:30' })).toEqual([
    6, 12, 18, 24,
  ]);
  expect(
    buildFocusedGridPage('grid.input.date', focusUrl('2026-10-28'), createFocusedOrderDb())
      .pagination.total,
  ).toBe(12);
});
it('filters picker single/multiple and remote multiple by actual customer identity', () => {
  const db = createFocusedOrderDb();
  const customers = [...new Set(db.orders.map((row) => row.customerId))];
  for (const type of ['selectTable', 'multipleSelectTable', 'remote-multiple']) {
    const wanted = type === 'selectTable' ? [customers[0]] : customers.slice(0, 2);
    const expected = db.orders
      .filter((row) => wanted.includes(row.customerId))
      .map((row) => row.id)
      .sort((a, b) => a - b);
    const page = buildFocusedGridPage(
      `grid.input.${type}`,
      focusUrl(type === 'selectTable' ? wanted[0] : wanted),
      db,
    );
    // Increase per_page to observe every matching row independently of paging.
    const all = buildFocusedGridPage(
      `grid.input.${type}`,
      `${focusUrl(type === 'selectTable' ? wanted[0] : wanted)}&per_page=50`,
      db,
    );
    expect(all.rows.map((row) => row.id).sort((a, b) => Number(a) - Number(b))).toEqual(expected);
    expect(page.pagination.total).toBe(expected.length);
  }
});
it('applies every exposed text group choice and keeps numeric input distinct from number range', () => {
  const wanted: Record<string, number[]> = {
    equal: [24],
    notEqual: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
    like: [24],
    startWith: [24],
    endWith: [24],
  };
  for (const op of ['equal', 'notEqual', 'like', 'startWith', 'endWith']) {
    const page = buildFocusedGridPage(
      'grid.input.group-text',
      `${focusUrl({ op, value: 'ORD-2610024' })}&per_page=50`,
      createFocusedOrderDb(),
    );
    expect(page.rows.map((row) => row.id).sort((a, b) => Number(a) - Number(b))).toEqual(
      wanted[op],
    );
  }
  expect(idsFor('numeric', '24')).toEqual([24]);
  expect(idsFor('range', { start: '23', end: '24' })).toEqual([23, 24]);
  expect(FOCUSED_INPUTS.numeric).toEqual({ type: 'text', inputMode: 'numeric' });
});
it('hydrates selected picker options and searches remote multiple options', async () => {
  const db = createFocusedOrderDb();
  expect(
    await respondFocusedGrid(db, {
      method: 'get',
      url: `${ORDERS_URL}/_brume/options/focus`,
      query: { value: ['c1', 'c2'] },
    }),
  ).toMatchObject({
    status: 200,
    data: {
      data: [
        { value: 'c1', label: '王小明' },
        { value: 'c2', label: '林美玲' },
      ],
    },
  });
  expect(
    await respondFocusedGrid(db, {
      method: 'get',
      url: `${ORDERS_URL}/_brume/options/focus`,
      query: { q: '王' },
    }),
  ).toMatchObject({ status: 200, data: { data: [{ value: 'c1', label: '王小明' }] } });
});
it('keeps custom subpath 422 atomic and returns all edited values with formatted displays', async () => {
  const db = createFocusedOrderDb();
  const edit = (column: string, value: unknown) =>
    respondFocusedGrid(db, {
      method: 'patch',
      url: `${ORDERS_URL}/_brume/cells/24`,
      body: { column, value },
    });
  const original = structuredClone(db.orders[23]?.formValues);
  expect(await edit('address', { county: '' })).toMatchObject({
    status: 422,
    data: { errors: { 'address.county': ['請填寫縣市。'] } },
  });
  expect(db.orders[23]?.formValues).toEqual(original);
  expect(await edit('currency', '0.00')).toMatchObject({ status: 422 });
  for (const [column, value] of Object.entries({
    currency: '1234.50',
    date: '2026-11-01',
    datetime: '2026-11-01T13:45',
    freeTags: ['vip', 'new'],
    address: { county: '臺中市', address: '成功路' },
  })) {
    const response = await edit(column, value);
    expect(response).toMatchObject({
      status: 200,
      data: { row: { _meta: { raw: { [column]: value } } } },
    });
  }
  expect(
    buildFocusedGridPage('grid.editor.currency', ORDERS_URL, db).rows.find((row) => row.id === 24)
      ?.currency,
  ).toBe('NT$ 1234.50');
  expect(await edit('payment', 'atm')).toMatchObject({
    status: 200,
    data: { row: { payment: 'atm' } },
  });
  expect(
    buildFocusedGridPage('grid.editor.radio', ORDERS_URL, db).columns.find(
      (column) => column.key === 'payment',
    )?.display,
  ).toMatchObject({ type: 'label', options: { atm: { label: 'ATM 轉帳' } } });
});
it('validates action input and enforces row visibility, whole-batch scope and partial eligibility', async () => {
  const db = createFocusedOrderDb();
  const action = (key: string, ids: number[], input?: unknown, target = 'batch') =>
    respondFocusedGrid(db, {
      method: 'post',
      url: `${ORDERS_URL}/_brume/actions/${key}`,
      body: { target, ids, input },
    });
  expect(await action('annotate', [24], { reason: '短' }, 'row')).toMatchObject({
    status: 422,
    data: { errors: { reason: ['原因至少 3 個字。'] } },
  });
  expect(await action('annotate', [24], { reason: '客服已確認' }, 'row')).toMatchObject({
    status: 200,
  });
  expect(db.orders[23]?.note).toBe('客服已確認');
  expect(await action('ship', [23], undefined, 'row')).toMatchObject({ status: 403 });
  expect(await action('mark_shipped', [23, 999999])).toMatchObject({ status: 403 });
  expect(await action('mark_shipped', [23])).toMatchObject({ status: 422 });
  expect(await action('mark_shipped', [23, 24])).toMatchObject({
    status: 200,
    data: {
      feedback: {
        toast: { type: 'warning', message: '已將 1 筆標記為已出貨，1 筆尚未付款所以略過。' },
      },
    },
  });
  expect(db.orders[22]?.status).toBe('pending');
  expect(db.orders[23]?.status).toBe('shipped');
});
it('generates actual all/page/selected downloads from query and current rows', () => {
  const db = createFocusedOrderDb();
  const page = exportFocusedOrders(`${ORDERS_URL}/export?export_scope=page&page=2&per_page=10`, db);
  const all = exportFocusedOrders(`${ORDERS_URL}/export?export_scope=all&page=2&per_page=10`, db);
  expect(page.ids).toHaveLength(10);
  expect(all.ids).toHaveLength(24);
  const selected = exportFocusedOrders(
    `${ORDERS_URL}/export?export_scope=selected&ids[]=24&ids[]=23&q=ORD-2610024`,
    db,
  );
  expect(selected.ids).toEqual([24]);
  expect(selected.text).toContain('ORD-2610024');
  expect(selected.text).not.toContain('ORD-2610023');
  expect(selected.filename).toBe('orders-selected.csv');
});
it('navigates to real page forms and persists through the shared form server', async () => {
  const db = createFocusedOrderDb();
  const form = buildFocusedResourcePage(`${ORDERS_URL}/24/edit`, db);
  expect(form).toMatchObject({
    presentation: 'page',
    mode: 'edit',
    values: { customer: db.orders[23]?.customer },
  });
  expect(
    await respondFocusedGrid(db, {
      method: 'put',
      url: `${ORDERS_URL}/24`,
      body: { values: { customer: '獨立頁修改', note: '已更新' }, after: 'list' },
    }),
  ).toMatchObject({ status: 200, data: { urls: { list: ORDERS_URL } } });
  expect(
    buildFocusedGridPage('grid.behavior.resource-page', ORDERS_URL, db).rows.find(
      (row) => row.id === 24,
    )?.customer,
  ).toBe('獨立頁修改');
  expect(buildFocusedResourcePage(`${ORDERS_URL}/create`, db)).toMatchObject({
    mode: 'create',
    submit: { method: 'post', url: ORDERS_URL },
  });
});
