import { describe, expect, it } from 'vitest';
import {
  BANNERS_URL,
  buildBannersPage,
  buildMenusPage,
  createBannerDb,
  createMenuDb,
  MENUS_URL,
  respondBannerReorder,
  respondMenuReorder,
} from './grid-ordering-data';

const post = (url: string, body: unknown) => ({ method: 'post' as const, url, body });
const bannerUrl = `${BANNERS_URL}/_brume/reorder`;
const menuUrl = `${MENUS_URL}/_brume/reorder`;
const undoOf = (res: { data: unknown } | undefined) =>
  (res?.data as { undo?: unknown } | undefined)?.undo;
const ids = (db: { banners: { id: number }[] }) => db.banners.map((b) => b.id);

describe('banner list server', () => {
  it('serves 45 rows, 20 per page, in stored order, with the ordering declaration', () => {
    const page = buildBannersPage(BANNERS_URL, createBannerDb());
    expect(page.rows).toHaveLength(20);
    expect(page.pagination).toMatchObject({ total: 45, lastPage: 3, perPage: 20 });
    expect(page.ordering).toEqual({ mode: 'list', column: 'sort', direction: 'asc' });
    expect(page.rows.map((r) => r.sort)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(
      buildBannersPage(`${BANNERS_URL}?filter[status]=off`, createBannerDb()).appliedFilters,
    ).toHaveLength(1);
  });
  it('lists every item regardless of filters', () => {
    const res = respondBannerReorder(createBannerDb(), { method: 'get', url: bannerUrl });
    expect((res?.data as { items?: unknown[] } | undefined)?.items).toHaveLength(45);
  });
  it('moves a row, renumbers, and returns an undo that restores it', () => {
    const db = createBannerDb();
    const res = respondBannerReorder(db, post(bannerUrl, { id: 3, before: 1 }));
    expect(ids(db).slice(0, 4)).toEqual([3, 1, 2, 4]);
    expect(res?.data).toEqual({ undo: { id: 3, before: 4 } });
    respondBannerReorder(db, post(bannerUrl, undoOf(res)));
    expect(ids(db)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    respondBannerReorder(db, post(bannerUrl, { id: 1, after: 3 }));
    expect(ids(db).slice(0, 3)).toEqual([2, 3, 1]);
    respondBannerReorder(db, post(bannerUrl, { id: 2 }));
    expect(ids(db).at(-1)).toBe(2);
  });
  it('replaces the whole order and rejects unknown ids with 409', () => {
    const db = createBannerDb(3);
    expect(respondBannerReorder(db, post(bannerUrl, { ids: [3, 2, 1] }))?.status).toBe(200);
    expect(ids(db)).toEqual([3, 2, 1]);
    expect(respondBannerReorder(db, post(bannerUrl, { ids: [3, 2, 99] }))?.status).toBe(409);
    expect(respondBannerReorder(db, post(bannerUrl, { id: 99 }))?.status).toBe(409);
    expect(respondBannerReorder(db, post(bannerUrl, { id: 1, before: 99 }))?.status).toBe(409);
    expect(ids(db)).toEqual([3, 2, 1]);
  });
});

describe('menu tree server', () => {
  const order = (db: ReturnType<typeof createMenuDb>) =>
    buildMenusPage(db).rows.map((r) => `${r.id}<${r._meta?.parent ?? '-'}`);
  it('serves all rows depth-first with parent, depth and maxDepth 2', () => {
    const page = buildMenusPage(createMenuDb());
    expect(page.ordering).toEqual({ mode: 'tree', column: 'order', direction: 'asc', maxDepth: 2 });
    expect(page.rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(page.rows[1]?._meta).toMatchObject({ parent: 1, depth: { name: 1 } });
  });
  it('re-parents, undoes, and returns the subtree with its node', () => {
    const db = createMenuDb();
    const res = respondMenuReorder(db, post(menuUrl, { id: 8, parent: 1, before: 2 }));
    expect(res?.status).toBe(200);
    expect(order(db).slice(0, 4)).toEqual(['1<-', '8<1', '2<1', '3<1']);
    respondMenuReorder(db, post(menuUrl, undoOf(res)));
    expect(order(db)).toEqual(order(createMenuDb()));
  });
  it('rejects a third level, a cycle and unknown ids with 409', () => {
    const db = createMenuDb();
    expect(respondMenuReorder(db, post(menuUrl, { id: 1, parent: 5 }))?.status).toBe(409);
    expect(respondMenuReorder(db, post(menuUrl, { id: 2, parent: 6 }))?.status).toBe(409);
    expect(respondMenuReorder(db, post(menuUrl, { id: 1, parent: 2 }))?.status).toBe(409);
    expect(respondMenuReorder(db, post(menuUrl, { id: 99, parent: null }))?.status).toBe(409);
    expect(order(db)).toEqual(order(createMenuDb()));
  });
});
