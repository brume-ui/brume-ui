/** Deterministic admin data for the 圖表 and 儀表板 pages (screenshots must not change run to run). */

/** Small seeded PRNG (mulberry32), so the "random" wiggle is identical every load. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seeded(20261028);

/** 營收 per day for October 2026, with a weekend lift and a slow upward drift. */
export const DAILY_REVENUE = Array.from({ length: 28 }, (_, i) => {
  const date = `2026-10-${String(i + 1).padStart(2, '0')}`;
  const weekday = new Date(`${date}T00:00:00+08:00`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6 ? 1.35 : 1;
  const online = Math.round((38000 + i * 650 + rand() * 9000) * weekend);
  const store = Math.round((26000 + rand() * 7000) * (weekend > 1 ? 1.15 : 1));
  return { date, online, store, total: online + store };
});

export const REVENUE_SERIES = [
  { key: 'online', label: '線上' },
  { key: 'store', label: '門市' },
];

/** 營收 by product category, online vs store (NT$). */
export const CATEGORY_REVENUE = [
  { category: '服飾', online: 486000, store: 312000 },
  { category: '家居', online: 254000, store: 298000 },
  { category: '3C 周邊', online: 612000, store: 188000 },
  { category: '美妝', online: 338000, store: 141000 },
  { category: '食品', online: 176000, store: 264000 },
  { category: '運動', online: 221000, store: 97000 },
];

/** Orders by status this month. */
export const ORDER_STATUS = [
  { label: '已完成', value: 1864 },
  { label: '已出貨', value: 402 },
  { label: '待出貨', value: 236 },
  { label: '待付款', value: 118 },
  { label: '已取消', value: 64 },
];

/** Many categories with long names, for the horizontal bars. */
export const TOP_PRODUCTS = [
  { name: '有機棉寬版長袖上衣', units: 1284 },
  { name: '無線降噪耳機 Pro', units: 1032 },
  { name: '手沖咖啡濾杯組', units: 876 },
  { name: '防潑水輕量登山背包', units: 702 },
  { name: '保濕修護精華液 30ml', units: 655 },
  { name: '北歐風陶瓷餐盤四入', units: 431 },
];

/** Monthly 訂單 (orders) for the last 12 months, for sparklines and the quarterly stack. */
export const MONTHLY_ORDERS = [
  1820, 1964, 2105, 1988, 2240, 2386, 2310, 2512, 2640, 2588, 2731, 2684,
];
export const MONTHLY_REVENUE = [4.1, 4.4, 4.9, 4.6, 5.2, 5.6, 5.3, 5.9, 6.4, 6.1, 6.8, 7.2].map(
  (m) => Math.round(m * 1_000_000),
);
export const MONTHLY_AOV = [2252, 2240, 2328, 2314, 2321, 2347, 2294, 2349, 2424, 2357, 2490, 2683];
export const MONTHLY_REFUND = [
  0.031, 0.029, 0.033, 0.028, 0.026, 0.027, 0.025, 0.024, 0.026, 0.022, 0.021, 0.019,
];

export const QUARTER_CHANNELS = [
  { quarter: 'Q1', online: 8.6, store: 5.1, partner: 1.2 },
  { quarter: 'Q2', online: 9.8, store: 5.4, partner: 1.9 },
  { quarter: 'Q3', online: 11.2, store: 5.0, partner: 2.6 },
  { quarter: 'Q4', online: 12.4, store: 5.3, partner: 3.1 },
].map((q) => ({
  quarter: q.quarter,
  online: Math.round(q.online * 1_000_000),
  store: Math.round(q.store * 1_000_000),
  partner: Math.round(q.partner * 1_000_000),
}));

export const TWD = { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 } as const;
