import type { Condition, FieldDef, FormNode, TreeOption } from '@brume-ui/brume-schema';

const field = (def: FieldDef): FormNode => ({ type: 'field', field: def });
const required = (message: string) => ({
  required: true as const,
  rules: [{ rule: 'required' as const, message }],
});

/** Invented small shop: product specs, selling points, branch names, a category tree, a size chart. */
export const keyValueField: FieldDef = {
  type: 'keyValue',
  name: 'specs',
  label: '商品規格',
  keyLabel: '規格',
  valueLabel: '內容',
  max: 8,
};
export const listField: FieldDef = {
  type: 'list',
  name: 'points',
  label: '商品賣點',
  maxLength: 20,
  max: 6,
  sortable: true,
};

const CITIES = ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市', '新竹市', '基隆市'];
/** 500 suggestions on purpose (the schema limit): the control must render at most 50. */
export const BRANCHES: string[] = [
  ...CITIES,
  ...Array.from({ length: 492 }, (_, i) => `示範分店 ${String(i + 1).padStart(3, '0')}`),
];
export const autocompleteField: FieldDef = {
  type: 'autocomplete',
  name: 'branch',
  label: '取貨門市',
  options: BRANCHES,
  maxLength: 40,
};

export const CATEGORY_TREE: TreeOption[] = [
  { value: 'drink', label: '飲品', depth: 0 },
  { value: 'tea', label: '茶類', depth: 1 },
  { value: 'tea-black', label: '紅茶', depth: 2 },
  { value: 'tea-green', label: '綠茶', depth: 2 },
  { value: 'coffee', label: '咖啡', depth: 1 },
  { value: 'snack', label: '點心', depth: 0 },
  { value: 'cake', label: '蛋糕', depth: 1 },
  { value: 'cookie', label: '餅乾', depth: 1 },
  { value: 'gift', label: '禮盒', depth: 0, disabled: true },
];
export const treeField = (name: string, label: string, mode: 'leaves' | 'all' | 'independent') =>
  ({ type: 'tree', name, label, options: CATEGORY_TREE, mode }) as FieldDef;

export const LISTBOX_OPTIONS = [
  { value: 'tw', label: '臺灣本島' },
  { value: 'outer', label: '離島' },
  { value: 'hk', label: '香港' },
  { value: 'jp', label: '日本' },
  { value: 'kr', label: '韓國' },
  { value: 'us', label: '美國', disabled: true },
];
export const listboxField: FieldDef = {
  type: 'multipleSelect',
  appearance: 'listbox',
  name: 'regions',
  label: '配送地區',
  options: LISTBOX_OPTIONS,
};

const eq = (path: string, value: string, scope: 'root' | 'row' = 'root'): Condition => ({
  op: 'eq',
  field: { scope, path },
  value,
});

const KIND_OPTIONS = [
  { value: 'physical', label: '實體商品' },
  { value: 'digital', label: '數位商品' },
  { value: 'service', label: '服務' },
];

/** A group repeats its showWhen on every field it holds (the server only looks at the field's own). */
const grouped = (when: Condition, ...fields: FieldDef[]): FormNode => ({
  type: 'group',
  showWhen: when,
  children: fields.map((f) => field({ ...f, showWhen: when })),
});

/** Six-column size chart rendered as a table (cards below 640 px). */
export const sizeChartField: FieldDef = {
  type: 'repeater',
  name: 'sizes',
  label: '尺寸表',
  mode: 'json',
  layout: 'table',
  sortable: true,
  min: 1,
  nodes: [
    field({ type: 'text', name: 'size', label: '尺碼', ...required('請填寫尺碼。') }),
    field({ type: 'text', name: 'chest', label: '胸圍' }),
    field({ type: 'text', name: 'waist', label: '腰圍' }),
    field({ type: 'text', name: 'hip', label: '臀圍' }),
    field({ type: 'text', name: 'length', label: '衣長' }),
    field({ type: 'text', name: 'note', label: '備註' }),
  ],
};

export const SIZE_ROWS = [
  { _brume: { key: 's1' }, size: 'S', chest: '88', waist: '70', hip: '90', length: '62', note: '' },
  {
    _brume: { key: 's2' },
    size: 'M',
    chest: '92',
    waist: '74',
    hip: '94',
    length: '64',
    note: '常見尺寸',
  },
];

export const STRUCTURAL_FIXTURES: Record<
  string,
  { nodes: FormNode[]; values: Record<string, unknown> }
> = {
  'form.field.keyValue': {
    nodes: [
      field(keyValueField),
      field({
        ...keyValueField,
        name: 'empty',
        label: '必填規格',
        ...required('請至少填寫一組規格。'),
      }),
      field({ ...keyValueField, name: 'locked', label: '唯讀規格', readOnly: true }),
      field({ ...keyValueField, name: 'off', label: '停用規格', disabled: true }),
    ],
    values: {
      specs: [
        { key: '材質', value: '純棉' },
        { key: '產地', value: '臺灣' },
        { key: '備註', value: '' },
      ],
      empty: [],
      locked: [{ key: '保固', value: '一年' }],
      off: [{ key: '顏色', value: '米白' }],
    },
  },
  'form.field.list': {
    nodes: [
      field(listField),
      field({
        ...listField,
        name: 'short',
        label: '至少兩項賣點',
        min: 2,
        ...required('請填寫賣點。'),
      }),
      field({ ...listField, name: 'locked', label: '唯讀賣點', readOnly: true }),
      field({ ...listField, name: 'off', label: '停用賣點', disabled: true }),
    ],
    values: {
      points: ['手工製作', '當日現做', '可客製刻字'],
      short: ['只有一項'],
      locked: ['限量'],
      off: ['預購'],
    },
  },
  'form.field.autocomplete': {
    nodes: [
      field(autocompleteField),
      field({
        type: 'autocomplete',
        name: 'required',
        label: '必填門市',
        options: BRANCHES.slice(0, 20),
        ...required('請填寫門市。'),
      }),
      field({ ...autocompleteField, name: 'locked', label: '唯讀門市', readOnly: true }),
      field({ ...autocompleteField, name: 'off', label: '停用門市', disabled: true }),
    ],
    values: { branch: null, required: null, locked: '臺北市', off: '新北市' },
  },
  'form.field.tree': {
    nodes: [
      field(treeField('leaves', '商品分類（只存葉節點）', 'leaves')),
      field(treeField('all', '商品分類（連父節點一起存）', 'all')),
      field(treeField('independent', '商品分類（各自獨立）', 'independent')),
      field({
        ...treeField('required', '必選分類', 'leaves'),
        ...required('請至少選一個分類。'),
      }),
      field({ ...treeField('locked', '唯讀分類', 'leaves'), readOnly: true }),
      field({ ...treeField('off', '停用分類', 'leaves'), disabled: true }),
    ],
    values: {
      leaves: ['tea-black'],
      all: [],
      independent: ['drink', 'cake'],
      required: [],
      locked: ['coffee'],
      off: ['cookie'],
    },
  },
  'form.layout.fieldset': {
    nodes: [
      {
        type: 'fieldset',
        key: 'basic',
        title: '基本資料',
        children: [
          field({ type: 'text', name: 'name', label: '商品名稱', ...required('請填寫商品名稱。') }),
        ],
      },
      {
        type: 'fieldset',
        key: 'shipping',
        title: '出貨設定（預設收合）',
        collapsed: true,
        children: [
          field({ type: 'text', name: 'origin', label: '出貨地', ...required('請填寫出貨地。') }),
          field(listboxField),
        ],
      },
      {
        type: 'fieldset',
        key: 'sizes',
        title: '尺寸表',
        children: [field(sizeChartField)],
      },
    ],
    values: {
      name: '手作棉衫',
      origin: '',
      regions: ['tw'],
      sizes: structuredClone(SIZE_ROWS),
    },
  },
  'form.layout.group': {
    nodes: [
      field({
        type: 'select',
        name: 'kind',
        label: '商品類型',
        options: KIND_OPTIONS,
        ...required('請選擇商品類型。'),
      }),
      grouped(eq('kind', 'physical'), {
        type: 'text',
        name: 'weight',
        label: '重量（公克）',
        ...required('請填寫重量。'),
      }),
      grouped(eq('kind', 'digital'), {
        type: 'text',
        name: 'download',
        label: '下載連結',
        ...required('請填寫下載連結。'),
      }),
      grouped(eq('kind', 'service'), {
        type: 'text',
        name: 'duration',
        label: '服務時數',
        ...required('請填寫服務時數。'),
      }),
      field({
        type: 'repeater',
        name: 'items',
        label: '訂單明細',
        mode: 'json',
        nodes: [
          field({
            type: 'select',
            name: 'kind',
            label: '明細類型',
            options: KIND_OPTIONS,
            ...required('請選擇明細類型。'),
          }),
          grouped(eq('kind', 'physical', 'row'), {
            type: 'text',
            name: 'sku',
            label: '貨號',
            ...required('請填寫貨號。'),
          }),
          grouped(eq('kind', 'service', 'row'), {
            type: 'text',
            name: 'hours',
            label: '時數',
            ...required('請填寫時數。'),
          }),
        ],
      }),
    ],
    values: {
      kind: 'physical',
      weight: '250',
      download: 'https://old.example/file',
      duration: '3',
      items: [
        { _brume: { key: 'a' }, kind: 'physical', sku: 'TS-001', hours: '9' },
        { _brume: { key: 'b' }, kind: 'service', sku: 'OLD-7', hours: '2' },
      ],
    },
  },
};

export const STRUCTURAL_GUIDES: Record<string, { steps: string[]; expected: string }> = {
  keyValue: {
    steps: [
      '在「商品規格」按「新增」加一組，輸入規格與內容；把兩列的規格改成相同再儲存。',
      '在「必填規格」不填直接儲存；觀察唯讀與停用的欄位。',
    ],
    expected:
      '請求值是保序的 { key, value } 陣列；規格去除前後空白，空白列靜默丟棄，重複的規格在第二列顯示錯誤；內容可以是空字串。',
  },
  list: {
    steps: [
      '編輯「商品賣點」，用上移、下移、拖曳握把或握把上的方向鍵調整順序，新增與刪除項目。',
      '「至少兩項賣點」只留一項再儲存；輸入超過 20 字或只有空白的項目。',
    ],
    expected: '請求值是字串陣列，只含空白的項目被丟棄、順序保留、可重複；每項最多 20 字。',
  },
  autocomplete: {
    steps: [
      '在「取貨門市」輸入「示範」，用方向鍵與 Enter 選一筆建議；再輸入一段沒有任何建議的文字後 Tab 離開。',
      '用注音輸入法組字時按 Enter：組字中的 Enter 只確認組字，不會選建議也不會送出表單。',
    ],
    expected:
      '500 個建議最多只顯示 50 筆；建議不限制輸入，沒有符合建議的文字照原樣儲存；空白存成 null。',
  },
  tree: {
    steps: [
      '用方向鍵、Space 在「商品分類」勾選；勾選茶類底下的單一子項，觀察父節點成為部分勾選（mixed）。',
      '比較三種模式：只存葉節點、連父節點一起存、各自獨立；按「全選」與「全部展開」。',
    ],
    expected:
      '請求值是節點 id 陣列，依各欄位的模式正規化；收合的子樹不會渲染，停用的節點不能改變。',
  },
  fieldset: {
    steps: [
      '展開「出貨設定」，不填出貨地再收合，按「儲存後繼續編輯」。',
      '在「尺寸表」新增、刪除、排序列；縮窄視窗到 390 px 時每列變成卡片。',
    ],
    expected:
      '儲存時收合的群組自動展開並聚焦未填欄位（收合後再失敗一次仍會展開）；收合不會丟值也不略過驗證；錯誤顯示在對應欄位旁。',
  },
  group: {
    steps: [
      '切換「商品類型」的三個分支，觀察只出現該分支的必填欄位；把分支欄位留空再儲存。',
      '在「訂單明細」兩列選不同類型，觀察各列各自的分支欄位。',
    ],
    expected:
      '隱藏分支的必填欄位不擋儲存，其值不會被伺服器接受（記憶體接受值不含隱藏分支）；列內分支各自獨立。',
  },
};

export function structuralGuide(key: string): { steps: string[]; expected: string } {
  const guide = STRUCTURAL_GUIDES[key];
  if (!guide) throw new Error(`Missing structural guide: ${key}`);
  return guide;
}
