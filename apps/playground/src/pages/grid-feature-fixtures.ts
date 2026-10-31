/** Focused declarations around the same public in-memory order server used by /grid. */
import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import {
  type FilterDef,
  type FilterInput,
  type FilterValue,
  type FormPage,
  type GridRow,
  type ListColumn,
  type ListPage,
  parseGridQuery,
} from '@brume-ui/brume-schema';
import { buildFormPage, buildStoredFormPage, respondForm } from './form-data';
import {
  buildOrdersPage,
  createOrderDb,
  ORDERS_URL,
  type OrderDb,
  respondOrders,
} from './grid-data';

const DISPLAY_KEYS: Record<string, string[]> = {
  text: ['customer'],
  label: ['status'],
  image: ['images'],
  component: ['address'],
  badge: ['channel'],
  link: ['service', 'serviceButton'],
  limit: ['note'],
  progress: ['progress'],
  qrcode: ['pickup'],
  copyable: ['tracking'],
  downloadable: ['invoice'],
  expand: ['detail'],
  modal: ['log'],
  table: ['items'],
};
const EDITOR_KEYS: Record<string, string[]> = {
  text: ['customer'],
  number: ['amount'],
  select: ['status'],
  switch: ['gift'],
  custom: ['address'],
  textarea: ['note'],
  radio: ['payment'],
  checkbox: ['tags'],
  switchGroup: ['flags'],
  date: ['date', 'datetime'],
  currency: ['currency'],
  tags: ['freeTags'],
};
export const FOCUSED_INPUTS: Record<string, FilterInput> = {
  text: { type: 'text' },
  select: { type: 'select', remote: true },
  multipleSelect: { type: 'multipleSelect', remote: true },
  radio: {
    type: 'radio',
    options: [
      { value: 'paid', label: '已付款' },
      { value: 'pending', label: '待付款' },
    ],
  },
  checkbox: {
    type: 'checkbox',
    options: [
      { value: 'web', label: '官網' },
      { value: 'app', label: 'App' },
    ],
  },
  date: { type: 'date', withTime: false },
  range: { type: 'range', of: 'number' },
  group: {
    type: 'group',
    of: 'number',
    operators: ['equal', 'gt', 'lt', 'ngt', 'nlt'].map((value) => ({ value, label: value })),
  },
  selectTable: { type: 'selectTable' },
  multipleSelectTable: { type: 'multipleSelectTable' },
  'date-time': { type: 'date', withTime: true },
  'range-text': { type: 'range', of: 'text' },
  'range-datetime': { type: 'range', of: 'datetime' },
  'group-text': {
    type: 'group',
    of: 'text',
    operators: ['equal', 'notEqual', 'like', 'startWith', 'endWith'].map((value) => ({
      value,
      label: value,
    })),
  },
  numeric: { type: 'text', inputMode: 'numeric' },
  'remote-multiple': { type: 'multipleSelect', remote: true },
};
export const GRID_EXTRA_COLUMNS: ListColumn[] = [
  {
    key: 'serviceButton',
    label: '客服按鈕',
    display: { type: 'link', style: 'button', external: true },
  },
  {
    key: 'address',
    label: '收件地址',
    display: { type: 'component', name: 'TaiwanAddress' },
    editor: { type: 'custom', component: { type: 'component', name: 'TaiwanAddress' } },
  },
  { key: 'date', label: '配送日期', editor: { type: 'date' } },
  { key: 'datetime', label: '預約時間', editor: { type: 'date', withTime: true } },
  {
    key: 'currency',
    label: '精確金額',
    numeric: true,
    editor: { type: 'currency', symbol: 'NT$', decimals: 2 },
  },
  {
    key: 'freeTags',
    label: '自由標籤',
    editor: {
      type: 'tags',
      options: [
        { value: 'vip', label: 'VIP' },
        { value: 'gift', label: '送禮' },
      ],
    },
  },
];
export const DOWNLOAD_FIXTURE = '/demo/order-receipt.txt';
export function createFocusedOrderDb(): OrderDb {
  const db = createOrderDb(24);
  for (const order of db.orders) {
    order.note = '請在週末前送達，送到公司櫃台並請警衛代收。';
    order.tracking = `TW${8000000000 + order.id}`;
    order.progress = order.id % 3 === 0 ? 100 : 50;
    order.status = order.id % 2 === 0 ? 'paid' : 'pending';
    order.created = `2026-10-${order.id % 2 === 0 ? '28' : '27'} 09:${order.id % 3 === 0 ? '30' : '31'}`;
    order.formValues = {
      ...order.formValues,
      address: { zipcode: '100', county: '臺北市', district: '中正區', address: '示範路 1 號' },
      date: '2026-10-28',
      datetime: '2026-10-28T09:30',
      currency: '1280.50',
      freeTags: ['vip', '自訂文字'],
    };
  }
  return db;
}
function enrich(row: GridRow, db: OrderDb): GridRow {
  const order = db.orders.find((item) => item.id === row.id);
  const fields = order?.formValues ?? {};
  return {
    ...row,
    ...fields,
    currency: `NT$ ${String(fields.currency ?? '1280.50')}`,
    service: '查看使用說明',
    serviceButton: '開啟文件',
    pickup: 'https://github.com/brume-ui',
    invoice: [
      { url: DOWNLOAD_FIXTURE, name: '訂單收據.txt' },
      { url: '/demo/order-items.csv', name: '訂單品項.csv' },
    ],
    _meta: {
      ...row._meta,
      raw: { ...row._meta?.raw, ...fields },
      href: {
        service: 'https://github.com/brume-ui',
        serviceButton: 'https://github.com/brume-ui',
      },
    },
  };
}
const scalar = (value: FilterValue | undefined) => (typeof value === 'string' ? value : '');
const list = (value: FilterValue | undefined) =>
  Array.isArray(value) ? value : scalar(value) ? [scalar(value)] : [];
const range = (value: FilterValue | undefined) =>
  value && typeof value === 'object' && !Array.isArray(value) && !('op' in value) ? value : {};
function matchesFocused(
  row: OrderDb['orders'][number],
  input: string,
  value: FilterValue,
): boolean {
  if (
    ['select', 'multipleSelect', 'selectTable', 'multipleSelectTable', 'remote-multiple'].includes(
      input,
    )
  )
    return list(value).includes(row.customerId);
  if (input === 'text') return row.no.includes(scalar(value));
  if (input === 'radio') return row.status === scalar(value);
  if (input === 'checkbox') return list(value).includes(row.channel);
  if (input === 'date') return row.created.slice(0, 10) === scalar(value);
  if (input === 'group' && typeof value === 'object' && !Array.isArray(value) && 'op' in value) {
    const target = Number(value.value);
    switch (value.op) {
      case 'equal':
        return row.id === target;
      case 'gt':
        return row.id > target;
      case 'lt':
        return row.id < target;
      case 'ngt':
        return row.id <= target;
      case 'nlt':
        return row.id >= target;
      default:
        return false;
    }
  }
  if (input === 'range') {
    const { start, end } = range(value);
    return (!start || row.id >= Number(start)) && (!end || row.id <= Number(end));
  }
  if (input === 'numeric') return row.id === Number(scalar(value));
  if (input === 'date-time')
    return row.created.replace(' ', 'T').slice(0, 16) === scalar(value).slice(0, 16);
  if (input === 'group-text') {
    if (typeof value !== 'object' || Array.isArray(value) || !('op' in value)) return true;
    const target = value.value;
    switch (value.op) {
      case 'equal':
        return row.no === target;
      case 'notEqual':
        return row.no !== target;
      case 'like':
        return row.no.includes(target);
      case 'startWith':
        return row.no.startsWith(target);
      case 'endWith':
        return row.no.endsWith(target);
      default:
        return false;
    }
  }
  const { start, end } = range(value);
  const text = input === 'range-datetime' ? row.created.replace(' ', 'T') : row.no;
  return (
    (!start || text >= start) &&
    (!end || text <= (input === 'range-datetime' ? `${end.slice(0, 16)}:59.999` : end))
  );
}
export function buildFocusedGridPage(id: string, url: string, db: OrderDb): ListPage {
  const suffix = id.split('.').at(-1) ?? '';
  const query = parseGridQuery(url.includes('?') ? url.slice(url.indexOf('?')) : '');
  const input = id.startsWith('grid.input.') ? FOCUSED_INPUTS[suffix] : undefined;
  const selected =
    input && query.filters.focus
      ? db.orders.filter((row) => matchesFocused(row, suffix, query.filters.focus as FilterValue))
      : db.orders;
  const page = buildOrdersPage(url, { ...db, orders: selected });
  const keys = id.startsWith('grid.display.')
    ? DISPLAY_KEYS[suffix]
    : id.startsWith('grid.editor.')
      ? EDITOR_KEYS[suffix]
      : undefined;
  const wanted =
    keys ??
    (id === 'grid.behavior.editor-format'
      ? ['payment', 'currency', 'address', 'freeTags']
      : ['customer', 'status', 'created']);
  const allColumns = [...page.columns, ...GRID_EXTRA_COLUMNS];
  return {
    ...page,
    title: 'Grid 聚焦示範',
    description: '記憶體訂單；指定欄位初始可見。',
    gridId: `focused-${id}`,
    columns: ['no', ...wanted].map((key) => ({
      ...(allColumns.find((column) => column.key === key) as ListColumn),
      hiddenByDefault: false,
    })),
    rows: page.rows.map((row) => {
      const value = enrich(row, db);
      if (id === 'grid.behavior.action-input')
        value._meta = { ...value._meta, actions: ['annotate'] };
      return value;
    }),
    ...(input
      ? {
          filters: {
            columns: 1,
            items: [
              { key: 'focus', label: '聚焦篩選', placement: 'panel', input } satisfies FilterDef,
            ],
          },
          appliedFilters: [
            ...page.appliedFilters,
            ...(query.filters.focus
              ? [{ key: 'focus', label: '聚焦篩選', display: JSON.stringify(query.filters.focus) }]
              : []),
          ],
        }
      : {}),
    ...(id === 'grid.behavior.action-input'
      ? {
          actions: {
            ...page.actions,
            row: [
              {
                key: 'annotate',
                label: '註記原因',
                exposed: true,
                form: {
                  title: '註記訂單',
                  fields: [{ type: 'text', name: 'reason', label: '原因', required: true }],
                  submitLabel: '套用註記',
                },
              },
            ],
          },
        }
      : {}),
    ...(id === 'grid.behavior.action-redirect'
      ? { actions: { ...page.actions, tools: [{ key: 'redirect', label: '前往已付款列表' }] } }
      : {}),
    ...(id === 'grid.behavior.resource-page'
      ? {
          resource: {
            ...page.resource,
            presentation: 'page',
            name: '訂單',
            createUrl: `${ORDERS_URL}/create`,
            editUrl: `${ORDERS_URL}/{id}/edit`,
          },
        }
      : {}),
  };
}
const ok = (data: unknown): HttpResponse => ({ status: 200, data });
const invalid = (errors: Record<string, string[]>): HttpResponse => ({
  status: 422,
  data: { message: '資料有誤', errors },
});
/** The focused additions use the same documented endpoints as the original Orders fixture. */
export async function respondFocusedGrid(db: OrderDb, req: HttpRequest): Promise<HttpResponse> {
  if (req.url.includes('/options/focus'))
    return respondOrders(db, {
      ...req,
      url: req.url.replace('/options/focus', '/options/customer'),
    });
  if (req.url.includes('/_brume/actions/') && req.method === 'post') {
    const body = req.body as { ids?: (number | string)[]; target?: string };
    if (body.target !== 'tool') {
      if (
        !Array.isArray(body.ids) ||
        !body.ids.length ||
        body.ids.some((id) => !db.orders.some((order) => order.id === id))
      )
        return { status: 403, data: { message: '所選訂單包含範圍外資料，未執行操作。' } };
      const key = req.url.split('/').at(-1) ?? '';
      if (body.target === 'row' && !['annotate'].includes(key)) {
        const row = buildOrdersPage(
          `${ORDERS_URL}?q=${db.orders.find((order) => order.id === body.ids?.[0])?.no}`,
          db,
        ).rows[0];
        if (body.ids.length !== 1 || !row?._meta?.actions?.includes(key))
          return { status: 403, data: { message: '此訂單狀態不允許執行動作。' } };
      }
    }
  }
  const cell = req.url.match(/\/_brume\/cells\/(\d+)$/);
  if (cell && req.method === 'patch') {
    const { column, value } = req.body as { column: string; value: unknown };
    const order = db.orders.find((row) => String(row.id) === cell[1]);
    if (!order) return { status: 404, data: { message: '找不到訂單。' } };
    if (GRID_EXTRA_COLUMNS.some((item) => item.key === column && item.editor)) {
      if (
        column === 'address' &&
        (!value ||
          typeof value !== 'object' ||
          !String((value as Record<string, unknown>).county ?? '').trim())
      )
        return invalid({ 'address.county': ['請填寫縣市。'] });
      if (
        column === 'currency' &&
        (typeof value !== 'string' || !/^\d+\.\d{2}$/.test(value) || Number(value) <= 0)
      )
        return invalid({ currency: ['請輸入大於零的兩位小數金額。'] });
      if (column === 'date' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)))
        return invalid({ date: ['請選擇日期。'] });
      if (
        column === 'datetime' &&
        (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
      )
        return invalid({ datetime: ['請選擇日期與時間。'] });
      if (
        column === 'freeTags' &&
        (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string'))
      )
        return invalid({ freeTags: ['標籤必須是文字陣列。'] });
      order.formValues = { ...order.formValues, [column]: structuredClone(value) };
      const page = buildOrdersPage(`${ORDERS_URL}?q=${encodeURIComponent(order.no)}`, db);
      return ok({ row: enrich(page.rows[0] as GridRow, db) });
    }
  }
  if (req.url.endsWith('/actions/annotate') && req.method === 'post') {
    const body = req.body as { ids: number[]; input?: { reason?: string } };
    const targets = db.orders.filter((order) => body.ids.includes(order.id));
    if (targets.length !== body.ids.length || !targets.length)
      return { status: 403, data: { message: '所選訂單不在本頁範圍。' } };
    const reason = body.input?.reason?.trim() ?? '';
    if (reason.length < 3) return invalid({ reason: ['原因至少 3 個字。'] });
    for (const order of targets) order.note = reason;
    return ok({ feedback: { toast: { type: 'success', message: '已儲存註記' }, refresh: true } });
  }
  if (req.url.endsWith('/actions/redirect') && req.method === 'post')
    return ok({
      feedback: {
        redirect: `${ORDERS_URL}?filter[status][]=paid`,
        refresh: true,
        toast: { type: 'info', message: '將前往已付款列表；redirect 優先於 refresh。' },
      },
    });
  if (req.url.endsWith('/actions/mark_shipped') && req.method === 'post') {
    const { ids } = req.body as { ids: number[] };
    if (!ids.length || ids.some((id) => !db.orders.some((order) => order.id === id)))
      return { status: 403, data: { message: '所選訂單包含範圍外資料，未執行操作。' } };
    if (!db.orders.some((order) => ids.includes(order.id) && order.status === 'paid'))
      return invalid({ ids: ['所選訂單全部未付款，未執行操作。'] });
  }
  const response = req.url.includes('/_brume/')
    ? await respondOrders(db, req)
    : await respondForm(req, db);
  if (cell && response.status === 200) {
    const data = response.data as { row: GridRow };
    return ok({ ...data, row: enrich(data.row, db) });
  }
  return response;
}
/** Download fixture contents, derived from the exact native Grid export URL and current DB. */
export function exportFocusedOrders(
  url: string,
  db: OrderDb,
): { filename: string; text: string; ids: (string | number)[] } {
  const parsed = new URL(url, 'https://demo.invalid');
  const scope = parsed.searchParams.get('export_scope');
  const selected = parsed.searchParams.getAll('ids[]');
  const page = buildOrdersPage(`${ORDERS_URL}${parsed.search}`, db);
  parsed.searchParams.set('per_page', '50');
  parsed.searchParams.set('page', '1');
  const rows =
    scope === 'page' ? page.rows : buildOrdersPage(`${ORDERS_URL}${parsed.search}`, db).rows;
  const result =
    scope === 'selected' ? rows.filter((row) => selected.includes(String(row.id))) : rows;
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return {
    filename: `orders-${scope ?? 'all'}.csv`,
    ids: result.map((row) => row.id),
    text:
      '\uFEFF訂單編號,客戶,狀態\r\n' +
      result.map((row) => [row.no, row.customer, row.status].map(quote).join(',')).join('\r\n'),
  };
}

/** Full page navigation uses the existing public form server and the same in-memory records. */
export function buildFocusedResourcePage(url: string, db: OrderDb): FormPage | null {
  const edit = url.match(/^\/admin\/orders\/(\d+)\/edit$/);
  const create = url === `${ORDERS_URL}/create`;
  const page = edit
    ? buildStoredFormPage(db, 'stacked', Number(edit[1]))
    : create
      ? buildFormPage('stacked', db.nextId)
      : null;
  if (!page) return null;
  page.presentation = 'page';
  page.listUrl = ORDERS_URL;
  page.after = { options: ['list', 'edit', 'create'], default: 'edit' };
  const first = page.form.nodes[0];
  if (first?.type === 'section')
    first.children.unshift({
      type: 'field',
      field: { type: 'text', name: 'customer', label: '客戶', required: true },
    });
  if (create) {
    page.mode = 'create';
    delete page.record;
    page.values.customer = '';
    page.values.note = '';
    page.title = '新增訂單';
    page.submit = { method: 'post', url: ORDERS_URL, label: '儲存' };
  }
  return page;
}
