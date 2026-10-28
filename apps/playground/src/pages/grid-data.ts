/**
 * A fake 訂單 back end for /#/grid: an in-memory table, the list page the server would answer for
 * a URL (filtered, sorted and paged locally through parseGridQuery), and the Action, cell and
 * options endpoints answered through the memory adapter's `respond`.
 */
import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import {
  type ActionDef,
  type ActionRequest,
  type AppliedFilter,
  type FilterDef,
  type FilterValue,
  type GridRow,
  type ListColumn,
  type ListPage,
  type Option,
  parseGridQuery,
} from '@brume-ui/brume-schema';

export const ORDERS_URL = '/admin/orders';
const ENDPOINTS = {
  action: `${ORDERS_URL}/_brume/actions/{action}`,
  cell: `${ORDERS_URL}/_brume/cells/{id}`,
  options: `${ORDERS_URL}/_brume/options/{source}`,
};
/** Every fake request takes this long, so pending states show. */
export const LATENCY_MS = 350;

// ─── Records ──────────────────────────────────────────────────────────────

type Status = 'pending' | 'paid' | 'shipped' | 'refunded' | 'cancelled';

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: number;
  no: string;
  customerId: string;
  customer: string;
  items: OrderItem[];
  status: Status;
  payment: string;
  channel: string;
  store: string;
  tags: string[];
  progress: number;
  gift: boolean;
  flags: { rush: boolean; invoice: boolean };
  note: string;
  tracking: string;
  /** YYYY-MM-DD HH:mm, Asia/Taipei. */
  created: string;
  risk: number;
}

const STATUS: Option[] = [
  { value: 'pending', label: '待付款' },
  { value: 'paid', label: '已付款' },
  { value: 'shipped', label: '已出貨' },
  { value: 'refunded', label: '已退款' },
  { value: 'cancelled', label: '已取消' },
];
const PAYMENT: Option[] = [
  { value: 'card', label: '信用卡' },
  { value: 'atm', label: 'ATM 轉帳' },
  { value: 'linepay', label: 'LINE Pay' },
  { value: 'cod', label: '貨到付款' },
];
const CHANNEL: Option[] = [
  { value: 'web', label: '官網' },
  { value: 'app', label: 'App' },
  { value: 'store', label: '門市' },
];
const STORE: Option[] = [
  { value: 'taipei', label: '台北' },
  { value: 'taichung', label: '台中' },
  { value: 'kaohsiung', label: '高雄' },
];
const TAGS: Option[] = [
  { value: 'vip', label: 'VIP' },
  { value: 'repeat', label: '回購' },
  { value: 'gift', label: '送禮' },
];
const AMOUNT_OPS: Option[] = [
  { value: 'gte', label: '至少' },
  { value: 'lte', label: '最多' },
  { value: 'eq', label: '等於' },
];

const CUSTOMERS = [
  '王小明',
  '林美玲',
  '陳志豪',
  '張雅婷',
  '李宗翰',
  '黃詩涵',
  '吳建宏',
  '劉怡君',
  '蔡佩珊',
  '楊家豪',
  '許雅雯',
  '鄭文傑',
].map((name, i) => ({ id: `c${i + 1}`, name }));

const PRODUCTS = [
  { name: '手沖咖啡豆 250g', price: 420, hue: 28 },
  { name: '陶瓷濾杯', price: 680, hue: 200 },
  { name: '玻璃分享壺', price: 520, hue: 180 },
  { name: '不鏽鋼細口壺', price: 1280, hue: 220 },
  { name: '冷泡茶包組', price: 360, hue: 120 },
  { name: '保溫隨行杯', price: 890, hue: 340 },
];

/** "Today" in the demo, so the 今日訂單 scope and the dates never drift. */
const TODAY = '2026-10-28';

/** Deterministic pseudo-random numbers (the same table on every load and in every screenshot). */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const pick = <T>(rand: () => number, list: readonly T[]): T =>
  list[Math.floor(rand() * list.length)] as T;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function makeOrder(id: number, rand: () => number): Order {
  const statusRoll = rand();
  const status: Status =
    statusRoll < 0.28
      ? 'pending'
      : statusRoll < 0.6
        ? 'paid'
        : statusRoll < 0.86
          ? 'shipped'
          : statusRoll < 0.93
            ? 'refunded'
            : 'cancelled';
  const customer = pick(rand, CUSTOMERS);
  const count = 1 + Math.floor(rand() * 3);
  const items = Array.from({ length: count }, () => {
    const p = pick(rand, PRODUCTS);
    return { name: p.name, qty: 1 + Math.floor(rand() * 2), price: p.price };
  });
  // Newest first by id: order 48 is today, older ones go back a few hours each.
  const hoursAgo = (48 - id) * 7 + Math.floor(rand() * 5);
  const base = Date.UTC(2026, 9, 28, 18, 30) - hoursAgo * 3_600_000;
  const d = new Date(base);
  const created = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  const tags = TAGS.filter(() => rand() < 0.25).map((t) => t.value);
  return {
    id,
    no: `ORD-2610${pad(id, 3)}`,
    customerId: customer.id,
    customer: customer.name,
    items,
    status,
    payment: pick(rand, PAYMENT).value,
    channel: pick(rand, CHANNEL).value,
    store: pick(rand, STORE).value,
    tags,
    progress: status === 'shipped' ? 100 : status === 'paid' ? 20 + Math.floor(rand() * 5) * 10 : 0,
    gift: tags.includes('gift'),
    flags: { rush: rand() < 0.2, invoice: rand() < 0.5 },
    note: rand() < 0.4 ? '請在週末前送達，送到公司櫃台並請警衛代收。' : '',
    tracking: status === 'shipped' ? `TW${Math.floor(rand() * 9e9 + 1e9)}` : '',
    created,
    risk: Math.floor(rand() * 100),
  };
}

export interface OrderDb {
  orders: Order[];
  nextId: number;
}

export function createOrderDb(count = 48): OrderDb {
  const rand = random(20261028);
  const orders = Array.from({ length: count }, (_, i) => makeOrder(i + 1, rand));
  return { orders, nextId: count + 1 };
}

// ─── Rows ─────────────────────────────────────────────────────────────────

const money = (n: number) => `NT$${n.toLocaleString('en')}`;
const amountOf = (o: Order) => o.items.reduce((sum, item) => sum + item.qty * item.price, 0);
const labelOf = (options: Option[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

/** A soft square product shot as an SVG data URL (no network in the playground or e2e). */
function productImage(name: string): string {
  const product = PRODUCTS.find((p) => p.name === name) ?? PRODUCTS[0];
  const hue = product?.hue ?? 200;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue} 45% 86%)"/><circle cx="32" cy="34" r="15" fill="hsl(${hue} 40% 62%)"/><rect x="22" y="14" width="20" height="8" rx="3" fill="hsl(${hue} 35% 48%)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Row actions this order allows, by status. */
function allowedActions(o: Order): string[] {
  switch (o.status) {
    case 'pending':
      return ['remind', 'duplicate', 'delete'];
    case 'paid':
      return ['ship', 'print', 'duplicate', 'delete'];
    case 'shipped':
      return ['print', 'duplicate'];
    default:
      return ['duplicate', 'delete'];
  }
}

export function toRow(o: Order): GridRow {
  const amount = amountOf(o);
  return {
    id: o.id,
    no: o.no,
    customer: o.customer,
    images: o.items.map((item) => productImage(item.name)),
    status: o.status,
    amount: money(amount),
    progress: o.progress,
    channel: labelOf(CHANNEL, o.channel),
    gift: o.gift,
    created: o.created,
    detail: `${o.items.length} 項`,
    payment: o.payment,
    tags: o.tags,
    flags: o.flags,
    note: o.note,
    tracking: o.tracking,
    pickup: `https://shop.example.com/pickup/${o.no}`,
    invoice: { url: `/files/invoices/${o.no}.pdf`, name: `${o.no} 發票.pdf` },
    service: '查看紀錄',
    items: o.items.map((item) => ({ name: item.name, qty: item.qty })),
    log: '3 筆',
    risk: o.risk,
    _meta: {
      actions: allowedActions(o),
      raw: { amount },
      href: { service: `/admin/tickets?order=${o.no}` },
      content: {
        detail: {
          type: 'table',
          columns: [
            { key: 'name', label: '商品' },
            { key: 'qty', label: '數量' },
            { key: 'subtotal', label: '小計' },
          ],
          rows: o.items.map((item) => ({
            name: item.name,
            qty: item.qty,
            subtotal: money(item.qty * item.price),
          })),
        },
        log: {
          type: 'text',
          text: `${o.created} 建立訂單\n${o.created} 寄出訂單確認信\n${TODAY} 09:12 客服備註：已電話確認收件地址`,
        },
      },
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────

const COLUMNS: ListColumn[] = [
  {
    key: 'no',
    label: '訂單編號',
    width: '8.5rem',
    primary: true,
    sortable: true,
    hideable: false,
  },
  {
    key: 'customer',
    label: '客戶',
    width: '10.5rem',
    editor: { type: 'text', maxLength: 20 },
    filter: 'customer_name',
  },
  {
    key: 'images',
    label: '商品',
    width: '7rem',
    display: { type: 'image', width: 32, height: 32 },
  },
  {
    key: 'status',
    label: '狀態',
    width: '6.5rem',
    display: {
      type: 'label',
      options: {
        pending: { label: '待付款', tone: 'warning' },
        paid: { label: '已付款', tone: 'info' },
        shipped: { label: '已出貨', tone: 'success' },
        refunded: { label: '已退款', tone: 'neutral' },
        cancelled: { label: '已取消', tone: 'danger' },
      },
    },
    editor: { type: 'select', options: STATUS },
  },
  {
    key: 'amount',
    label: '金額',
    width: '7.5rem',
    numeric: true,
    sortable: true,
    editor: { type: 'number', min: 0, step: 1 },
  },
  { key: 'progress', label: '出貨進度', sortable: true, display: { type: 'progress', max: 100 } },
  { key: 'channel', label: '通路', hiddenByDefault: true, display: { type: 'badge' } },
  { key: 'gift', label: '禮品包裝', width: '5.5rem', editor: { type: 'switch' } },
  { key: 'created', label: '下單時間', width: '9.5rem', sortable: true },
  { key: 'detail', label: '明細', width: '7rem', display: { type: 'expand' } },
  {
    key: 'payment',
    label: '付款方式',
    hiddenByDefault: true,
    display: {
      type: 'label',
      options: Object.fromEntries(
        PAYMENT.map((p) => [p.value, { label: p.label, tone: 'neutral' as const }]),
      ),
    },
    editor: { type: 'radio', options: PAYMENT },
  },
  {
    key: 'tags',
    label: '標籤',
    hiddenByDefault: true,
    display: {
      type: 'label',
      options: Object.fromEntries(
        TAGS.map((t) => [t.value, { label: t.label, tone: 'neutral' as const }]),
      ),
    },
    editor: { type: 'checkbox', options: TAGS },
  },
  {
    key: 'flags',
    label: '處理標記',
    hiddenByDefault: true,
    editor: {
      type: 'switchGroup',
      keys: [
        { key: 'rush', label: '急件' },
        { key: 'invoice', label: '開發票' },
      ],
    },
  },
  {
    key: 'note',
    label: '備註',
    hiddenByDefault: true,
    display: { type: 'limit', length: 10 },
    editor: { type: 'textarea' },
  },
  { key: 'tracking', label: '物流單號', hiddenByDefault: true, display: { type: 'copyable' } },
  { key: 'pickup', label: '取貨碼', hiddenByDefault: true, display: { type: 'qrcode' } },
  { key: 'invoice', label: '發票', hiddenByDefault: true, display: { type: 'downloadable' } },
  { key: 'service', label: '客服', hiddenByDefault: true, display: { type: 'link' } },
  {
    key: 'items',
    label: '品項',
    hiddenByDefault: true,
    display: {
      type: 'table',
      columns: [
        { key: 'name', label: '商品' },
        { key: 'qty', label: '數量' },
      ],
    },
  },
  {
    key: 'log',
    label: '操作紀錄',
    hiddenByDefault: true,
    display: { type: 'modal', label: '查看紀錄', title: '訂單操作紀錄' },
  },
  {
    key: 'risk',
    label: '風險分數',
    hiddenByDefault: true,
    numeric: true,
    display: { type: 'component', name: 'RiskScore' },
  },
];

const PANEL_FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: '狀態',
    placement: 'panel',
    input: { type: 'multipleSelect', options: STATUS },
  },
  { key: 'customer', label: '客戶', placement: 'panel', input: { type: 'select', remote: true } },
  {
    key: 'no',
    label: '訂單編號',
    placement: 'panel',
    input: { type: 'text', placeholder: '例如 ORD-2610' },
  },
  {
    key: 'created',
    label: '下單日期',
    placement: 'panel',
    span: 2,
    input: { type: 'range', of: 'date' },
  },
  {
    key: 'amount',
    label: '金額',
    placement: 'panel',
    input: { type: 'group', of: 'number', operators: AMOUNT_OPS },
  },
  {
    key: 'payment',
    label: '付款方式',
    placement: 'panel',
    input: { type: 'radio', options: PAYMENT },
  },
  {
    key: 'channel',
    label: '通路',
    placement: 'panel',
    input: { type: 'checkbox', options: CHANNEL },
  },
  { key: 'qty', label: '件數', placement: 'panel', input: { type: 'range', of: 'number' } },
  {
    key: 'shipped_on',
    label: '出貨日',
    placement: 'panel',
    input: { type: 'date', withTime: false },
  },
  { key: 'customer_id', label: '客戶代碼', placement: 'hidden', input: { type: 'text' } },
];

const COLUMN_FILTERS: FilterDef[] = [
  {
    key: 'customer_name',
    label: '客戶名稱',
    placement: 'column',
    input: { type: 'text', placeholder: '輸入部分名稱' },
  },
];

const SELECTORS = [
  { key: 'store', label: '門市', multiple: false, options: STORE },
  { key: 'tag', label: '標籤', multiple: true, options: TAGS },
];

const SCOPES = [
  { key: 'today', label: '今日訂單' },
  { key: 'unshipped', label: '待出貨' },
  { key: 'vip', label: 'VIP 客戶' },
];

const ROW_ACTIONS: ActionDef[] = [
  { key: 'ship', label: '出貨', icon: 'truck', exposed: true, shortcut: 'S' },
  { key: 'remind', label: '提醒付款', icon: 'bell', exposed: true, shortcut: 'R' },
  { key: 'print', label: '列印出貨單', icon: 'printer', shortcut: 'P' },
  { key: 'duplicate', label: '複製訂單', icon: 'copy', shortcut: 'D' },
  {
    key: 'delete',
    label: '刪除',
    icon: 'trash',
    tone: 'danger',
    shortcut: 'Delete',
    confirm: { title: '刪除這筆資料？', description: '刪除後無法復原。', confirmLabel: '刪除' },
  },
];

const BATCH_ACTIONS: ActionDef[] = [
  { key: 'mark_shipped', label: '標記為已出貨', icon: 'truck' },
  {
    key: 'delete',
    label: '刪除',
    icon: 'trash',
    tone: 'danger',
    confirm: {
      title: '刪除所選的 {count} 筆資料？',
      description: '刪除後無法復原。',
      confirmLabel: '刪除 {count} 筆',
    },
  },
];

const TOOL_ACTIONS: ActionDef[] = [{ key: 'sync', label: '同步金流狀態', icon: 'credit-card' }];

const SORTABLE: Record<string, (o: Order) => string | number> = {
  no: (o) => o.no,
  amount: amountOf,
  progress: (o) => o.progress,
  created: (o) => o.created,
};

const asList = (v: FilterValue | undefined): string[] =>
  Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [];
const asText = (v: FilterValue | undefined): string =>
  typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : '';
const asRange = (v: FilterValue | undefined): { start?: string; end?: string } =>
  v && typeof v === 'object' && !Array.isArray(v) && !('op' in v) ? v : {};
const asCondition = (v: FilterValue | undefined) =>
  v && typeof v === 'object' && !Array.isArray(v) && 'op' in v ? v : undefined;

function inRange(value: string | number, range: { start?: string; end?: string }): boolean {
  const num = typeof value === 'number';
  const from = range.start ? (num ? Number(range.start) : range.start) : undefined;
  const to = range.end ? (num ? Number(range.end) : range.end) : undefined;
  if (from !== undefined && value < from) return false;
  if (to !== undefined && value > to) return false;
  return true;
}

function rangeText(range: { start?: string; end?: string }): string {
  if (range.start && range.end) return `${range.start} – ${range.end}`;
  return range.start ? `${range.start} 起` : `${range.end} 止`;
}

/** Whether an order passes every filter, the scope and the search. */
function matches(o: Order, query: ReturnType<typeof parseGridQuery>): boolean {
  const f = query.filters;
  if (query.q) {
    const q = query.q.toLowerCase();
    if (!o.no.toLowerCase().includes(q) && !o.customer.includes(query.q)) return false;
  }
  if (query.scope === 'today' && !o.created.startsWith(TODAY)) return false;
  if (query.scope === 'unshipped' && o.status !== 'paid') return false;
  if (query.scope === 'vip' && !o.tags.includes('vip')) return false;
  const status = asList(f.status);
  if (status.length > 0 && !status.includes(o.status)) return false;
  if (f.customer && o.customerId !== asText(f.customer)) return false;
  if (f.customer_id && o.customerId !== asText(f.customer_id)) return false;
  if (f.no && !o.no.toLowerCase().includes(asText(f.no).toLowerCase())) return false;
  if (f.created && !inRange(o.created.slice(0, 10), asRange(f.created))) return false;
  const cond = asCondition(f.amount);
  if (cond) {
    const amount = amountOf(o);
    const n = Number(cond.value);
    if (cond.op === 'gte' && !(amount >= n)) return false;
    if (cond.op === 'lte' && !(amount <= n)) return false;
    if (cond.op === 'eq' && amount !== n) return false;
  }
  if (f.payment && o.payment !== asText(f.payment)) return false;
  const channel = asList(f.channel);
  if (channel.length > 0 && !channel.includes(o.channel)) return false;
  if (f.qty) {
    const qty = o.items.reduce((sum, item) => sum + item.qty, 0);
    if (!inRange(qty, asRange(f.qty))) return false;
  }
  if (f.shipped_on && (o.status !== 'shipped' || !o.created.startsWith(asText(f.shipped_on))))
    return false;
  if (f.customer_name && !o.customer.includes(asText(f.customer_name))) return false;
  if (f.store && o.store !== asText(f.store)) return false;
  const tag = asList(f.tag);
  if (tag.length > 0 && !tag.some((t) => o.tags.includes(t))) return false;
  return true;
}

/** What the server says is applied: one entry per filter key, plus scope and q. */
function appliedFilters(query: ReturnType<typeof parseGridQuery>): AppliedFilter[] {
  const out: AppliedFilter[] = [];
  const all = [...PANEL_FILTERS, ...COLUMN_FILTERS];
  for (const [key, value] of Object.entries(query.filters)) {
    const def = all.find((d) => d.key === key);
    const selector = SELECTORS.find((s) => s.key === key);
    if (selector) {
      const labels = asList(value).map((v) => labelOf(selector.options, v));
      out.push({ key, label: selector.label, display: labels.join('、') });
      continue;
    }
    if (!def) continue;
    let display = asText(value);
    const input = def.input;
    if (key === 'customer') {
      display = CUSTOMERS.find((c) => c.id === display)?.name ?? display;
    } else if (input.type === 'multipleSelect' || input.type === 'checkbox') {
      display = asList(value)
        .map((v) => labelOf(input.options ?? [], v))
        .join('、');
    } else if (input.type === 'radio') {
      display = labelOf(input.options, display);
    } else if (input.type === 'range') {
      display = rangeText(asRange(value));
    } else if (input.type === 'group') {
      const cond = asCondition(value);
      display = cond ? `${labelOf(input.operators, cond.op)} ${cond.value}` : '';
    }
    out.push({ key, label: def.label, display });
  }
  if (query.scope) {
    out.push({
      key: 'scope',
      label: '範圍',
      display: SCOPES.find((s) => s.key === query.scope)?.label ?? query.scope,
    });
  }
  if (query.q) out.push({ key: 'q', label: '搜尋', display: query.q });
  return out;
}

const PER_PAGE_OPTIONS = [10, 20, 50];

/** The list page the server would answer for `url` (path + search). */
export function buildOrdersPage(url: string, db: OrderDb): ListPage {
  const search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  const query = parseGridQuery(search);
  let found = db.orders.filter((o) => matches(o, query));
  const sortKey = query.sort && SORTABLE[query.sort.key] ? query.sort : undefined;
  // Newest first unless the URL asks for another order (that default is not echoed back).
  const by = sortKey ? SORTABLE[sortKey.key] : SORTABLE.created;
  const dir = sortKey ? (sortKey.direction === 'asc' ? 1 : -1) : -1;
  found = [...found].sort((a, b) => {
    const x = by?.(a) ?? 0;
    const y = by?.(b) ?? 0;
    return (x < y ? -1 : x > y ? 1 : 0) * dir || b.id - a.id;
  });
  const perPage = PER_PAGE_OPTIONS.includes(query.perPage ?? 0) ? (query.perPage ?? 10) : 10;
  const lastPage = Math.max(1, Math.ceil(found.length / perPage));
  const page = Math.min(query.page ?? 1, lastPage);
  return {
    type: 'list',
    title: '訂單',
    description: '查看與處理顧客訂單；點訂單編號開啟編輯。',
    gridId: 'orders',
    columns: COLUMNS,
    rows: found.slice((page - 1) * perPage, page * perPage).map(toRow),
    pagination: { page, perPage, total: found.length, lastPage },
    query: {
      perPage,
      filters: query.filters,
      ...(sortKey ? { sort: sortKey } : {}),
      ...(query.q ? { q: query.q } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
    },
    perPageOptions: PER_PAGE_OPTIONS,
    quickSearch: { placeholder: '搜尋訂單編號或客戶' },
    filters: {
      columns: 3,
      items: [
        ...PANEL_FILTERS.slice(0, 3),
        { type: 'newline' },
        ...PANEL_FILTERS.slice(3, 5),
        { type: 'newline' },
        ...PANEL_FILTERS.slice(5),
      ],
    },
    columnFilters: COLUMN_FILTERS,
    selectors: SELECTORS,
    scopes: SCOPES,
    appliedFilters: appliedFilters(query),
    actions: { row: ROW_ACTIONS, batch: BATCH_ACTIONS, tools: TOOL_ACTIONS },
    export: { url: `${ORDERS_URL}/export` },
    endpoints: ENDPOINTS,
  };
}

// ─── Endpoints ────────────────────────────────────────────────────────────

const ok = (data: unknown): HttpResponse => ({ status: 200, data });
const invalid = (message: string, errors?: Record<string, string[]>): HttpResponse => ({
  status: 422,
  data: { message, ...(errors ? { errors } : {}) },
});

function runAction(db: OrderDb, key: string, req: ActionRequest): HttpResponse {
  const targets = db.orders.filter((o) => req.ids.includes(o.id));
  const one = targets[0];
  switch (key) {
    case 'ship': {
      if (one?.status !== 'paid') return invalid('只有已付款的訂單可以出貨。');
      one.status = 'shipped';
      one.progress = 100;
      one.tracking = `TW${8_000_000_000 + one.id}`;
      return ok({
        feedback: { toast: { type: 'success', message: `${one.no} 已安排出貨` }, refresh: true },
      });
    }
    case 'remind':
      if (one?.customer === '鄭文傑') return invalid('這位客戶沒有留下手機號碼，無法發送提醒。');
      // No feedback: the client shows 已完成「提醒付款」 and refreshes.
      return ok({});
    case 'print':
      if (!one) return invalid('找不到這筆訂單。');
      return ok({
        feedback: {
          toast: { type: 'info', message: '出貨單已產生，開始下載。' },
          download: {
            url: `data:text/plain;charset=utf-8,${encodeURIComponent(`出貨單 ${one.no}\n客戶：${one.customer}`)}`,
            filename: `${one.no}-出貨單.txt`,
          },
        },
      });
    case 'duplicate': {
      if (!one) return invalid('找不到這筆訂單。');
      const copy: Order = {
        ...one,
        id: db.nextId,
        no: `ORD-2610${pad(db.nextId, 3)}`,
        status: 'pending',
        progress: 0,
        tracking: '',
        created: `${TODAY} 18:45`,
      };
      db.nextId += 1;
      db.orders.push(copy);
      return ok({
        feedback: { toast: { type: 'success', message: `已複製為 ${copy.no}` }, refresh: true },
      });
    }
    case 'delete':
      db.orders = db.orders.filter((o) => !req.ids.includes(o.id));
      return ok({
        feedback: {
          toast: { type: 'success', message: `已刪除 ${targets.length} 筆` },
          refresh: true,
        },
      });
    case 'mark_shipped': {
      const paid = targets.filter((o) => o.status === 'paid');
      for (const o of paid) {
        o.status = 'shipped';
        o.progress = 100;
      }
      const skipped = targets.length - paid.length;
      return ok({
        feedback: {
          toast: {
            type: skipped > 0 ? 'warning' : 'success',
            message:
              skipped > 0
                ? `已將 ${paid.length} 筆標記為已出貨，${skipped} 筆尚未付款所以略過。`
                : `已將 ${paid.length} 筆標記為已出貨`,
          },
          refresh: true,
        },
      });
    }
    case 'sync':
      return ok({});
    default:
      return { status: 404, data: { message: '沒有這個操作。' } };
  }
}

function updateCell(db: OrderDb, id: string, column: string, value: unknown): HttpResponse {
  const order = db.orders.find((o) => String(o.id) === id);
  if (!order) return { status: 404, data: { message: '找不到這筆訂單。' } };
  switch (column) {
    case 'customer': {
      const name = String(value ?? '').trim();
      if (!name) return invalid('資料有誤', { customer: ['請填寫客戶名稱。'] });
      if ([...name].length > 10) {
        return invalid('資料有誤', { customer: ['客戶名稱最多 10 個字。'] });
      }
      order.customer = name;
      break;
    }
    case 'amount': {
      const n = Number(value);
      if (value === null || !Number.isFinite(n) || n <= 0) {
        return invalid('資料有誤', { amount: ['金額要大於 0。'] });
      }
      // The amount edits the first item's price, so the total comes out at n.
      const rest = order.items.slice(1).reduce((s, i) => s + i.qty * i.price, 0);
      const first = order.items[0];
      if (first) first.price = Math.max(0, (n - rest) / first.qty);
      break;
    }
    case 'status':
      order.status = String(value) as Status;
      order.progress = order.status === 'shipped' ? 100 : order.status === 'paid' ? 20 : 0;
      break;
    case 'payment':
      order.payment = String(value);
      break;
    case 'tags':
      order.tags = Array.isArray(value) ? value.map(String) : [];
      order.gift = order.tags.includes('gift');
      break;
    case 'gift':
      order.gift = value === true;
      break;
    case 'flags':
      order.flags = { ...order.flags, ...(value as Partial<Order['flags']>) };
      break;
    case 'note': {
      const note = String(value ?? '');
      if (note.length > 200) return invalid('資料有誤', { note: ['備註最多 200 個字。'] });
      order.note = note;
      break;
    }
    default:
      return invalid(`「${column}」不能在列表上修改。`);
  }
  return ok({ row: toRow(order) });
}

function customerOptions(query: HttpRequest['query']): HttpResponse {
  const values = query?.value;
  if (Array.isArray(values)) {
    return ok({
      data: CUSTOMERS.filter((c) => values.includes(c.id)).map((c) => ({
        value: c.id,
        label: c.name,
      })),
      pagination: { page: 1, perPage: 20, hasMore: false },
    });
  }
  const q = typeof query?.q === 'string' ? query.q : '';
  const page = Number(query?.page ?? 1);
  const perPage = Number(query?.per_page ?? 20);
  const found = CUSTOMERS.filter((c) => c.name.includes(q));
  return ok({
    data: found
      .slice((page - 1) * perPage, page * perPage)
      .map((c) => ({ value: c.id, label: c.name, description: c.id.toUpperCase() })),
    pagination: { page, perPage, hasMore: page * perPage < found.length },
  });
}

/** The fake server: Action, cell and options endpoints. */
export async function respondOrders(db: OrderDb, req: HttpRequest): Promise<HttpResponse> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  const path = req.url.replace(`${ORDERS_URL}/_brume/`, '');
  const [kind, raw = ''] = path.split('/');
  const param = decodeURIComponent(raw);
  if (kind === 'actions' && req.method === 'post') {
    return runAction(db, param, req.body as ActionRequest);
  }
  if (kind === 'cells' && req.method === 'patch') {
    const { column, value } = req.body as { column: string; value: unknown };
    return updateCell(db, param, column, value);
  }
  if (kind === 'options' && req.method === 'get' && param === 'customer') {
    return customerOptions(req.query);
  }
  return { status: 404, data: { message: '找不到這個端點。' } };
}
