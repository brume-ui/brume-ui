/** Reproducible requests for the workbench's public Resource route, independent of sibling files. */
const OPERATORS: Record<string, { value: unknown; expected: string }> = {
  equal: { value: ['kitchen'], expected: 'FD-001、FD-003（集合相等轉 whereIn）' },
  notEqual: { value: ['kitchen'], expected: 'FD-002、FD-004（集合不等轉 whereNotIn）' },
  like: { value: 'king', expected: 'FD-002；大小寫依 DB/collation' },
  ilike: { value: 'ADA', expected: 'FD-001、FD-002；LOWER 包含' },
  startWith: { value: 'Ada_', expected: 'FD-001；底線按字面匹配' },
  endWith: { value: '50%', expected: 'FD-001；百分號按字面匹配' },
  gt: { value: '20', expected: 'FD-003、FD-004' },
  lt: { value: '20', expected: 'FD-001' },
  ngt: { value: '20', expected: 'FD-001、FD-002' },
  nlt: { value: '20', expected: 'FD-002、FD-003、FD-004' },
  in: { value: ['kitchen', 'textile'], expected: 'FD-001、FD-003、FD-004' },
  notIn: { value: ['kitchen', 'textile'], expected: 'FD-002' },
  findInSet: { value: '1', expected: 'FD-001；不把 1 當作 12' },
  date: { value: '2026-02-14', expected: 'FD-002' },
  day: { value: '28', expected: 'FD-003' },
  month: { value: '2', expected: 'FD-002、FD-003' },
  year: { value: '2025', expected: 'FD-004' },
  between: { value: { start: '10', end: '20' }, expected: 'FD-001、FD-002；包含邊界，亦允許單端' },
  whereBetween: {
    value: { end: '20' },
    expected: 'FD-001、FD-002；callback 收到 start/end，OR 不擴大根查詢',
  },
  where: { value: '20', expected: 'FD-002；callback 收值，OR 不擴大根查詢' },
  group: {
    value: { op: 'gt', value: '20' },
    expected: 'FD-003、FD-004；非法 op 不會套用（200，沒有 chip），不是任意 SQL',
  },
  hidden: { value: 'kitchen', expected: 'FD-001、FD-003；沒有輸入控制但有 applied chip' },
};
const QUERIES: Record<string, { query: Record<string, unknown>; expected: string }> = {
  json: {
    query: { filter: { demo: ['gift'] } },
    expected:
      'FD-001；改成 filter[exclude][]=gift 得 FD-002～004。SQLite LIKE fallback 不能視為原生 JSON。',
  },
  'json-path': {
    query: { filter: { demo: 'teal' } },
    expected: 'FD-001；條件作用於 meta->color。',
  },
  relation: {
    query: { filter: { demo: '林' } },
    expected: 'FD-001；加 q=FD-002 得空集合，whereHas 保持根查詢。',
  },
  defaults: { query: {}, expected: '首次 FD-001、FD-003；加 filter= 明確清除後四筆全部回來。' },
  'driver-notes': {
    query: { filter: { minute: { start: '2026-01-05T09:30', end: '2026-01-05T09:30' } } },
    expected: 'FD-001 的 09:30:59 包含在結束分鐘內；day 以整個結束日期計算。',
  },
  'column-operators': {
    query: { filter: { stock: '20' } },
    expected:
      'stock 標頭是 gt，得 FD-003、FD-004。其他標頭的 11 種映射在 GridFocusedDemosTest 逐項核對，input 是 like 的輸入別名。',
  },
  'sort-custom': {
    query: { sort: 'price' },
    expected:
      '自訂 asc 刻意反向：FD-004、003、002、001。無 sort 或非法 secret_note 則回到 sku asc。',
  },
  'export-values': {
    query: {},
    expected:
      '用匯出選單下載真正 XLSX：分類為廚房，原始金額是數字 100，格式化金額為文字 100.00；exportUsing 註記 FD-001：1,12,3，秘密欄不匯出。未顯式排除的 hidden 欄位另由 ExportTest 證明拒絕。',
  },
  'row-id': {
    query: {},
    expected:
      'id 欄保留實際 model 的數字身份；SKU 只顯示格式化業務編號。StringKeyTest／ExportTest 另外驗證字串 abc 與 007 不接受數字或大小寫別名。asRowId 是 Grid 內部標記，不是應用程式改寫身份的方法。',
  },
};
function appendQuery(params: URLSearchParams, prefix: string, value: unknown) {
  if (Array.isArray(value)) for (const item of value) params.append(`${prefix}[]`, String(item));
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value)) appendQuery(params, `${prefix}[${key}]`, item);
  else params.set(prefix, String(value));
}
export function gridBackendEvidence(id: string) {
  const suffix = id.split('.').at(-1) ?? '';
  const operator = id.startsWith('grid.operator.') ? OPERATORS[suffix] : undefined;
  const query = operator
    ? { filter: { demo: operator.value }, sort: 'sku' }
    : (QUERIES[suffix]?.query ?? {});
  const params = new URLSearchParams({ example: id });
  for (const [key, value] of Object.entries(query)) appendQuery(params, key, value);
  return {
    path: `/admin/grid-showcase?${params}`,
    query,
    expected: operator?.expected ?? QUERIES[suffix]?.expected ?? '',
  };
}

export const BACKEND_GRID_IDS = [
  ...Object.keys(OPERATORS).map((key) => `grid.operator.${key}`),
  ...Object.keys(QUERIES).map((key) => `grid.query.${key}`),
];
