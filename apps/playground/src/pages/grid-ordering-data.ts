/**
 * Drag-sort demos: an orderable banner list and a two-level menu tree behind a fake server.
 * The server answers the `endpoints.reorder` protocol (GET items, POST move / full order, 409 on a
 * move it cannot make). Lives with the playground's other demo servers, not in the generic memory
 * adapter, which only forwards requests to a `respond` callback.
 */
import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import {
  type FilterValue,
  type GridRow,
  type ListColumn,
  type ListPage,
  parseGridQuery,
  type ReorderMoveRequest,
} from '@brume-ui/brume-schema';

export const BANNERS_URL = '/admin/banners';
export const MENUS_URL = '/admin/menus';
const BANNERS_REORDER = `${BANNERS_URL}/_brume/reorder`;
const MENUS_REORDER = `${MENUS_URL}/_brume/reorder`;
type Id = string | number;
const PER_PAGE_OPTIONS = [20, 50];

// ─── Banner list ──────────────────────────────────────────────────────────

export interface Banner {
  id: number;
  title: string;
  status: 'live' | 'off';
}
/** The list in its stored order; a banner's 排序 value is its position (1-based). */
export interface BannerDb {
  banners: Banner[];
}

const BANNER_NAMES = [
  '雙十一全館滿額折',
  '新會員首購禮',
  '冬季羽絨外套特賣',
  '手沖咖啡器具展',
  '年終回饋抽獎',
  '週末限定免運',
  '聖誕交換禮物提案',
  '跨年倒數快閃',
  '品牌聯名新品上市',
  '會員日雙倍點數',
];
const BANNER_SUFFIX = ['首頁主視覺', '分類頁橫幅', '結帳頁提醒', '電子報頭圖', '行動版彈跳'];

export function createBannerDb(count = 45): BannerDb {
  return {
    banners: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `${BANNER_NAMES[i % BANNER_NAMES.length]}・${BANNER_SUFFIX[Math.floor(i / BANNER_NAMES.length) % BANNER_SUFFIX.length]}`,
      status: i % 4 === 3 ? 'off' : 'live',
    })),
  };
}

const STATUS_LABELS = { live: '上架中', off: '已下架' } as const;
const BANNER_COLUMNS: ListColumn[] = [
  { key: 'title', label: '橫幅名稱', primary: true },
  {
    key: 'status',
    label: '狀態',
    display: {
      type: 'label',
      options: {
        live: { label: '上架中', tone: 'success' },
        off: { label: '已下架', tone: 'neutral' },
      },
    },
  },
  { key: 'sort', label: '排序', numeric: true },
];

const scalar = (value: FilterValue | undefined) => (typeof value === 'string' ? value : '');

/** The page the server answers for `url`: filtered, 20 per page, in the stored order. */
export function buildBannersPage(url: string, db: BannerDb): ListPage {
  const query = parseGridQuery(url.includes('?') ? url.slice(url.indexOf('?')) : '');
  const status = scalar(query.filters.status);
  const rank = new Map(db.banners.map((banner, index) => [banner.id, index + 1]));
  const found = db.banners.filter((banner) => !status || banner.status === status);
  const perPage = PER_PAGE_OPTIONS.includes(query.perPage ?? 0) ? (query.perPage ?? 20) : 20;
  const lastPage = Math.max(1, Math.ceil(found.length / perPage));
  const page = Math.min(query.page ?? 1, lastPage);
  return {
    type: 'list',
    title: '首頁橫幅',
    description: '拖曳列首的握把調整顯示順序；套用篩選後握把停用，仍可用「調整順序」。',
    gridId: 'drag-banners',
    columns: BANNER_COLUMNS,
    rows: found.slice((page - 1) * perPage, page * perPage).map((banner) => ({
      id: banner.id,
      title: banner.title,
      status: banner.status,
      sort: rank.get(banner.id) ?? 0,
    })),
    pagination: { page, perPage, total: found.length, lastPage },
    query: { perPage, filters: query.filters },
    perPageOptions: PER_PAGE_OPTIONS,
    filters: {
      columns: 1,
      items: [
        {
          key: 'status',
          label: '狀態',
          placement: 'panel',
          input: {
            type: 'radio',
            options: [
              { value: 'live', label: STATUS_LABELS.live },
              { value: 'off', label: STATUS_LABELS.off },
            ],
          },
        },
      ],
    },
    appliedFilters: status
      ? [
          {
            key: 'status',
            label: '狀態',
            display: STATUS_LABELS[status as Banner['status']] ?? status,
          },
        ]
      : [],
    actions: { row: [], batch: [], tools: [] },
    endpoints: { reorder: BANNERS_REORDER },
    ordering: { mode: 'list', column: 'sort', direction: 'asc' },
  };
}

// ─── Menu tree ────────────────────────────────────────────────────────────

export interface MenuNode {
  id: number;
  parent: number | null;
  name: string;
  url?: string;
  enabled: boolean;
}
/** Every node; the array order is the sibling order (a node precedes its later siblings). */
export interface MenuDb {
  nodes: MenuNode[];
}
export const MENU_MAX_DEPTH = 2;

export function createMenuDb(): MenuDb {
  return {
    nodes: [
      { id: 1, parent: null, name: '商品', enabled: true },
      { id: 2, parent: 1, name: '全部商品', url: '/products', enabled: true },
      { id: 3, parent: 1, name: '新品上市', url: '/products/new', enabled: true },
      { id: 4, parent: 1, name: '限時特賣', url: '/products/sale', enabled: false },
      { id: 5, parent: null, name: '會員專區', enabled: true },
      { id: 6, parent: 5, name: '我的訂單', url: '/account/orders', enabled: true },
      { id: 7, parent: 5, name: '點數與優惠券', enabled: true },
      { id: 8, parent: null, name: '品牌故事', url: '/about', enabled: true },
      { id: 9, parent: null, name: '客服中心', enabled: true },
      { id: 10, parent: 9, name: '常見問題', url: '/help/faq', enabled: true },
      { id: 11, parent: 9, name: '聯絡我們', url: '/help/contact', enabled: true },
    ],
  };
}

const MENU_COLUMNS: ListColumn[] = [
  { key: 'name', label: '選單名稱', primary: true, tree: true },
  { key: 'url', label: '連結' },
  {
    key: 'state',
    label: '狀態',
    display: { type: 'label', options: { off: { label: '已停用', tone: 'neutral' } } },
  },
];

/** Every node, depth-first (a parent before its children), as the tree grid wants them. */
export function buildMenusPage(db: MenuDb): ListPage {
  const rows: GridRow[] = [];
  const walk = (parent: number | null, depth: number) => {
    for (const node of db.nodes.filter((n) => n.parent === parent)) {
      rows.push({
        id: node.id,
        name: node.name,
        ...(node.url ? { url: node.url } : {}),
        ...(node.enabled ? {} : { state: 'off' }),
        _meta: { parent: node.parent, depth: { name: depth } },
      });
      walk(node.id, depth + 1);
    }
  };
  walk(null, 0);
  return {
    type: 'list',
    title: '網站選單',
    description: '拖曳握把調整順序；水平移動可變更層級（最多兩層）。',
    gridId: 'drag-menus',
    columns: MENU_COLUMNS,
    rows,
    pagination: { page: 1, perPage: rows.length, total: rows.length, lastPage: 1 },
    query: { perPage: rows.length, filters: {} },
    perPageOptions: [rows.length],
    appliedFilters: [],
    actions: { row: [], batch: [], tools: [] },
    endpoints: { reorder: MENUS_REORDER },
    ordering: { mode: 'tree', column: 'order', direction: 'asc', maxDepth: MENU_MAX_DEPTH },
  };
}

// ─── Reorder endpoint ─────────────────────────────────────────────────────

const ok = (data: unknown): HttpResponse => ({ status: 200, data });
const conflict = (message: string): HttpResponse => ({ status: 409, data: { message } });
const same = (a: Id | null | undefined, b: Id | null | undefined) =>
  a != null && b != null && String(a) === String(b);

/** Moves `item` next to `before`/`after`, or last when neither is given. Returns false when the anchor is missing. */
function place<T extends { id: number }>(
  list: T[],
  item: T,
  anchor: { before?: Id; after?: Id },
  inScope: (other: T) => boolean = () => true,
): boolean {
  const rest = list.filter((other) => other !== item);
  const target = anchor.before ?? anchor.after;
  let at = -1;
  if (target === undefined) {
    // Last among its (new) siblings.
    const last = rest.map(inScope).lastIndexOf(true);
    at = last + 1;
  } else {
    const index = rest.findIndex((other) => same(other.id, target) && inScope(other));
    if (index < 0 || same(item.id, target)) return false;
    at = anchor.before !== undefined ? index : index + 1;
  }
  list.splice(0, list.length, ...rest.slice(0, at), item, ...rest.slice(at));
  return true;
}

const isMove = (body: unknown): body is ReorderMoveRequest =>
  typeof body === 'object' && body !== null && 'id' in body;
const isFull = (body: unknown): body is { ids: Id[] } =>
  typeof body === 'object' && body !== null && Array.isArray((body as { ids?: unknown }).ids);

export function respondBannerReorder(db: BannerDb, req: HttpRequest): HttpResponse | undefined {
  if (req.url !== BANNERS_REORDER) return undefined;
  if (req.method === 'get')
    return ok({ items: db.banners.map((banner) => ({ id: banner.id, label: banner.title })) });
  if (req.method !== 'post') return undefined;
  const body = req.body;
  if (isFull(body)) {
    const ids = body.ids.map(String);
    const known = new Set(db.banners.map((banner) => String(banner.id)));
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => known.has(id))
    )
      return conflict('橫幅清單已變動，請重新整理後再調整順序。');
    const byId = new Map(db.banners.map((banner) => [String(banner.id), banner]));
    db.banners = ids.map((id) => byId.get(id) as Banner);
    return ok({});
  }
  if (!isMove(body)) return conflict('無法辨識的排序請求。');
  const banner = db.banners.find((item) => same(item.id, body.id));
  if (!banner) return conflict('找不到要移動的橫幅，可能已被刪除。');
  const index = db.banners.indexOf(banner);
  const next = db.banners[index + 1];
  const undo: ReorderMoveRequest = { id: banner.id, ...(next ? { before: next.id } : {}) };
  const list = [...db.banners];
  if (!place(list, banner, { before: body.before, after: body.after }))
    return conflict('目標位置的橫幅已不存在，請重新整理。');
  db.banners = list;
  return ok({ undo });
}

const childrenOf = (db: MenuDb, parent: number | null) =>
  db.nodes.filter((n) => n.parent === parent);
const depthOf = (db: MenuDb, node: MenuNode): number => {
  let depth = 1;
  for (let up = node; up.parent !== null; depth++) {
    const parent = db.nodes.find((n) => n.id === up.parent);
    if (!parent) break;
    up = parent;
  }
  return depth;
};
const heightOf = (db: MenuDb, node: MenuNode): number =>
  1 + Math.max(0, ...childrenOf(db, node.id).map((child) => heightOf(db, child)));

export function respondMenuReorder(db: MenuDb, req: HttpRequest): HttpResponse | undefined {
  if (req.url !== MENUS_REORDER) return undefined;
  if (req.method === 'get')
    return ok({ items: db.nodes.map((node) => ({ id: node.id, label: node.name })) });
  if (req.method !== 'post') return undefined;
  const body = req.body;
  if (!isMove(body)) return conflict('選單只能一次移動一個項目。');
  const node = db.nodes.find((item) => same(item.id, body.id));
  if (!node) return conflict('找不到要移動的選單項目，可能已被刪除。');
  const newParent =
    body.parent === undefined
      ? node.parent
      : body.parent === null
        ? null
        : (db.nodes.find((item) => same(item.id, body.parent))?.id ?? undefined);
  if (newParent === undefined) return conflict('找不到新的上層項目，請重新整理。');
  if (newParent !== null) {
    const parent = db.nodes.find((item) => item.id === newParent) as MenuNode;
    for (let up: MenuNode | undefined = parent; up; up = db.nodes.find((n) => n.id === up?.parent))
      if (up === node) return conflict('不能把項目移到自己的下層。');
    if (depthOf(db, parent) + heightOf(db, node) > MENU_MAX_DEPTH)
      return conflict(`選單最多 ${MENU_MAX_DEPTH} 層。`);
  } else if (heightOf(db, node) > MENU_MAX_DEPTH)
    return conflict(`選單最多 ${MENU_MAX_DEPTH} 層。`);
  const siblings = childrenOf(db, node.parent);
  const next = siblings[siblings.indexOf(node) + 1];
  const undo: ReorderMoveRequest = {
    id: node.id,
    parent: node.parent,
    ...(next ? { before: next.id } : {}),
  };
  const nodes = [...db.nodes];
  const moved = { ...node, parent: newParent };
  nodes[nodes.indexOf(node)] = moved;
  if (
    !place(nodes, moved, { before: body.before, after: body.after }, (n) => n.parent === newParent)
  )
    return conflict('目標位置的項目已不存在，請重新整理。');
  db.nodes = nodes;
  return ok({ undo });
}
