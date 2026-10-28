/**
 * 與後端無關的列表網址參數協定（規格見 docs/url-params.md）。
 * 只用 URLSearchParams，不引入任何依賴。
 */

export const GRID_PARAMS = {
  page: 'page',
  perPage: 'per_page',
  sort: 'sort',
  q: 'q',
  scope: 'scope',
  filter: 'filter',
} as const;

export type SortDirection = 'asc' | 'desc';

export type FilterValue =
  | string
  | string[]
  | { start?: string; end?: string }
  | { op: string; value: string };

export interface GridQuery {
  page?: number;
  perPage?: number;
  sort?: { key: string; direction: SortDirection };
  q?: string;
  scope?: string;
  filters: Record<string, FilterValue>;
}

const OWNED_SCALARS: string[] = [
  GRID_PARAMS.page,
  GRID_PARAMS.perPage,
  GRID_PARAMS.sort,
  GRID_PARAMS.q,
  GRID_PARAMS.scope,
];

// filter[name] / filter[name][] / filter[name][sub]
const FILTER_KEY = /^filter\[([^\][]+)\](?:\[([^\][]*)\])?$/;

function toParams(search: string | URLSearchParams): URLSearchParams {
  return typeof search === 'string' ? new URLSearchParams(search) : search;
}

function positiveInt(raw: string | null): number | undefined {
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : undefined;
}

interface FilterDraft {
  scalar?: string;
  list: string[];
  start?: string;
  end?: string;
  op?: string;
  value?: string;
}

function resolveFilter(d: FilterDraft): FilterValue | undefined {
  if (d.list.length > 0) return d.list;
  if (d.op && d.value) return { op: d.op, value: d.value };
  if (d.start || d.end) {
    return {
      ...(d.start ? { start: d.start } : {}),
      ...(d.end ? { end: d.end } : {}),
    };
  }
  return d.scalar || undefined;
}

export function parseGridQuery(search: string | URLSearchParams): GridQuery {
  const params = toParams(search);
  const query: GridQuery = { filters: {} };

  const page = positiveInt(params.get(GRID_PARAMS.page));
  if (page !== undefined) query.page = page;

  const perPage = positiveInt(params.get(GRID_PARAMS.perPage));
  if (perPage !== undefined) query.perPage = perPage;

  const sort = params.get(GRID_PARAMS.sort);
  if (sort) {
    const desc = sort.startsWith('-');
    const key = desc ? sort.slice(1) : sort;
    if (key) query.sort = { key, direction: desc ? 'desc' : 'asc' };
  }

  const q = params.get(GRID_PARAMS.q);
  if (q) query.q = q;

  const scope = params.get(GRID_PARAMS.scope);
  if (scope) query.scope = scope;

  const drafts = new Map<string, FilterDraft>();
  for (const [key, value] of params) {
    const match = FILTER_KEY.exec(key);
    if (!match) continue;
    const name = match[1] as string;
    const sub = match[2];
    let draft = drafts.get(name);
    if (!draft) {
      draft = { list: [] };
      drafts.set(name, draft);
    }
    if (sub === undefined) draft.scalar = value;
    else if (sub === '') {
      if (value) draft.list.push(value);
    } else if (sub === 'start' || sub === 'end' || sub === 'op' || sub === 'value') {
      draft[sub] = value;
    }
  }
  for (const [name, draft] of drafts) {
    const resolved = resolveFilter(draft);
    if (resolved !== undefined) query.filters[name] = resolved;
  }

  return query;
}

function isOwned(key: string): boolean {
  return OWNED_SCALARS.includes(key) || FILTER_KEY.test(key);
}

/** 把 query 寫成參數；base 內非本協定的參數原樣保留，本協定的參數由 query 取代。 */
export function serializeGridQuery(query: GridQuery, base?: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  if (base) {
    for (const [key, value] of base) {
      if (!isOwned(key)) out.append(key, value);
    }
  }

  if (query.page !== undefined) out.set(GRID_PARAMS.page, String(query.page));
  if (query.perPage !== undefined) out.set(GRID_PARAMS.perPage, String(query.perPage));
  if (query.sort?.key) {
    out.set(GRID_PARAMS.sort, (query.sort.direction === 'desc' ? '-' : '') + query.sort.key);
  }
  if (query.q) out.set(GRID_PARAMS.q, query.q);
  if (query.scope) out.set(GRID_PARAMS.scope, query.scope);

  for (const [name, value] of Object.entries(query.filters)) {
    const prefix = `${GRID_PARAMS.filter}[${name}]`;
    if (typeof value === 'string') {
      if (value) out.set(prefix, value);
    } else if (Array.isArray(value)) {
      for (const item of value) if (item) out.append(`${prefix}[]`, item);
    } else if ('op' in value) {
      if (value.op && value.value) {
        out.set(`${prefix}[op]`, value.op);
        out.set(`${prefix}[value]`, value.value);
      }
    } else {
      if (value.start) out.set(`${prefix}[start]`, value.start);
      if (value.end) out.set(`${prefix}[end]`, value.end);
    }
  }

  return out;
}

/** 以 patch 合併後回傳新網址（path + search + hash）；patch 內只要有 page 以外的鍵，page 就回到 1（刪掉 page 參數）。 */
export function withGridQuery(currentUrl: string, patch: Partial<GridQuery>): string {
  const hashAt = currentUrl.indexOf('#');
  const hash = hashAt === -1 ? '' : currentUrl.slice(hashAt);
  const beforeHash = hashAt === -1 ? currentUrl : currentUrl.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const base = new URLSearchParams(queryAt === -1 ? '' : beforeHash.slice(queryAt + 1));

  const merged: GridQuery = { ...parseGridQuery(base), ...patch };
  if (merged.filters === undefined) merged.filters = {};
  if (Object.keys(patch).some((key) => key !== 'page')) delete merged.page;

  const search = serializeGridQuery(merged, base).toString();
  return path + (search ? `?${search}` : '') + hash;
}
