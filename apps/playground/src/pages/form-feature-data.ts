import type { CustomFieldDef, FieldDef, FormNode } from '@brume-ui/brume-schema';

export const node = (field: FieldDef): FormNode => ({ type: 'field', field });
export const text = (name: string, label: string): FieldDef => ({ type: 'text', name, label });
export const opts = [
  { value: 'A', label: '甲' },
  { value: 'B', label: '乙' },
];
export const address: CustomFieldDef = {
  type: 'custom',
  name: 'address',
  label: '地址',
  component: { type: 'component', name: 'TaiwanAddress' },
};
export const upload: FieldDef = {
  type: 'upload',
  name: 'files',
  label: '附件',
  kind: 'file',
  multiple: true,
  accept: ['text/plain'],
  maxSize: 1024,
  maxFiles: 2,
  sortable: true,
  extra: [{ type: 'text', name: 'note', label: '附件備註' }],
};
export const FIELD_EXAMPLES: { field: FieldDef; value: unknown; title: string }[] = [
  ...(['text', 'textarea', 'email', 'url', 'mobile', 'password', 'hidden', 'display'] as const).map(
    (type) => ({
      field: { type, name: 'value', label: '欄位值' },
      value:
        (
          {
            email: 'demo@example.test',
            url: 'https://example.test',
            hidden: 'hidden-token-42',
            display: '建立於 2026-11-01',
          } as Record<string, string>
        )[type] ?? '範例文字',
      title: {
        text: '文字',
        textarea: '多行文字',
        email: '電子郵件',
        url: '網址',
        mobile: '電話',
        password: '密碼',
        hidden: '隱藏值',
        display: '唯讀顯示',
      }[type],
    }),
  ),
  { field: { type: 'number', name: 'value', label: '數量', step: 1 }, value: 2, title: '整數輸入' },
  {
    field: { type: 'decimal', name: 'value', label: '小數', decimals: 3 },
    value: '1.250',
    title: '精確小數',
  },
  {
    field: { type: 'currency', name: 'amount', label: '金額', decimals: 2, symbol: 'NT$' },
    value: '19.90',
    title: '精確金額',
  },
  ...(['date', 'datetime', 'dateRange', 'datetimeRange'] as const).map((type) => ({
    field: { type, name: 'value', label: '日期時間' },
    value:
      type === 'datetimeRange'
        ? { start: '2026-11-01T09:30', end: '2026-11-02T17:00' }
        : type === 'dateRange'
          ? { start: '2026-11-01', end: '2026-11-02' }
          : type === 'datetime'
            ? '2026-11-01T09:30'
            : '2026-11-01',
    title: {
      date: '日期',
      datetime: '日期與時間',
      dateRange: '日期區間',
      datetimeRange: '時間區間',
    }[type],
  })),
  ...(['select', 'multipleSelect', 'radio', 'checkbox', 'tags'] as const).map((type) => ({
    field: { type, name: 'value', label: '選項', options: opts },
    value: ['multipleSelect', 'checkbox', 'tags'].includes(type) ? ['A'] : 'A',
    title: {
      select: '單選',
      multipleSelect: '多選',
      radio: '單選方塊',
      checkbox: '核取群組',
      tags: '標籤',
    }[type],
  })),
  { field: { type: 'switch', name: 'value', label: '啟用' }, value: true, title: '開關' },
  { field: upload, value: [], title: '附件上傳' },
  {
    field: address,
    value: { county: '臺北', zipcode: '100', district: '中正', address: '示範路1號' },
    title: '自訂地址',
  },
  {
    field: {
      type: 'repeater',
      name: 'rows',
      label: '重複列',
      mode: 'json',
      sortable: true,
      nodes: [node(text('name', '列名稱'))],
    },
    value: [{ _brume: { key: 'a' }, name: '第一列' }],
    title: '重複列',
  },
  {
    field: {
      type: 'relation',
      name: 'selection',
      label: '商品挑選',
      multiple: true,
      remote: { url: '/demo/focused/options' },
      fields: [node(text('note', '商品備註'))],
    },
    value: [{ id: '1', note: '草稿' }],
    title: '關聯挑選',
  },
];
export const UPLOAD_PRESETS: {
  id: string;
  title: string;
  field: Extract<FieldDef, { type: 'upload' }>;
}[] = (['image-single', 'image-multiple', 'file-single', 'file-multiple'] as const).map((id) => ({
  id: `upload.${id}`,
  title: {
    'image-single': '單張圖片',
    'image-multiple': '多張圖片',
    'file-single': '單個檔案',
    'file-multiple': '多個檔案',
  }[id],
  field: {
    ...upload,
    type: 'upload',
    name: 'files',
    kind: id.startsWith('image') ? 'image' : 'file',
    multiple: id.endsWith('multiple'),
    accept: id.startsWith('image') ? ['image/png'] : ['application/pdf'],
    maxSize: 1024,
    maxFiles: 2,
  },
}));
export interface FormExample {
  id: string;
  route: 'form-fields' | 'form-layouts' | 'form-behaviors';
  title: string;
  steps: string[];
  expected: string;
  kind: string;
}
const behaviorTitles: Record<string, string> = {
  'readonly-disabled': '唯讀、停用與隱藏值',
  'default-value': '新列的預設權威值',
  'enable-when': '依條件啟用',
  'conditions-row': '列內與根層條件',
  'condition-invalid-control': '無效控制值的保守驗證',
  'submit-after-list': '儲存後返回列表',
  'submit-after-edit': '儲存後繼續編輯',
  'submit-after-create': '儲存後新增',
  'submit-after-view': '儲存後檢視',
  'submit-cancel': '取消回應保留草稿',
  'submit-network': '網路失敗與重試',
  server422: '伺服器欄位錯誤與重試',
  'custom-readonly': '自訂地址的狀態與錯誤',
  'custom-display-only': '純顯示自訂地址',
  'client-rule-message': '前後端驗證訊息比對',
};
export const FORM_EXAMPLES: FormExample[] = [
  ...FIELD_EXAMPLES.map(({ field, title }) => ({
    id: `form.field.${field.type}`,
    route: 'form-fields' as const,
    title,
    kind: 'field',
    steps: [
      '修改可編輯欄位，再按「儲存後繼續編輯」。',
      '比較目前草稿、實際請求與記憶體儲存值；唯讀欄位只供查看。',
    ],
    expected: '值出現在實際請求；精確數值保持字串。隱藏值仍可由草稿與請求核對。',
  })),
  ...UPLOAD_PRESETS.map(({ id, title, field }) => ({
    id,
    title,
    route: 'form-fields' as const,
    kind: 'upload-preset',
    steps: [
      `選擇小於1KB的${field.kind === 'image' ? 'PNG 圖片' : 'PDF 檔案'}；${field.multiple ? '最多兩個，可排序並填寫附件備註' : '再次選檔會取代原檔'}。`,
      '按儲存後繼續編輯，核對模擬 token 與單檔／多檔資料形狀；上傳失敗可移除後重選。',
    ],
    expected: '實際 multipart 請求取得模擬暫存 token；未寫入資料庫或永久歸檔。',
  })),
  ...Object.entries({
    stacked: '直向標籤',
    horizontal: '橫向標籤',
    'sections-stack': '堆疊分段',
    'sections-tabs': '頁籤分段',
    field: '一般欄位',
    section: '分段',
    row: '比例列',
    columns: '分欄',
    block: '卡片區塊',
    divider: '分隔線',
    embeds: '巢狀物件',
  }).map(([id, title]) => ({
    id: `form.layout.${id}`,
    route: 'form-layouts' as const,
    title,
    kind: 'layout',
    steps: ['先儲存空白城市，觀察錯誤與焦點。', '若使用頁籤，切換「地址分段」，輸入城市再儲存。'],
    expected: '錯誤可導向對應分段；儲存值的 address.city 保持巢狀結構。',
  })),
  ...Object.entries(behaviorTitles).map(([id, title]) => ({
    id: `form.behavior.${id}`,
    route: 'form-behaviors' as const,
    title,
    kind: id,
    steps: behaviorSteps(id),
    expected: behaviorExpected(id),
  })),
  ...['eq', 'ne', 'in', 'empty', 'all', 'any', 'not'].map((id) => ({
    id: `form.condition.${id}`,
    route: 'form-behaviors' as const,
    title: `條件運算 ${id}`,
    kind: 'conditions',
    steps: [
      '改變類型、核取啟用，再清空文字與多選值。',
      '觀察標有運算名稱的欄位出現／消失；切回原條件查看草稿。',
    ],
    expected: '各欄位依自己的公開條件顯示；empty 同時展示空字串、null 與空陣列。',
  })),
  ...[
    'integer',
    'numeric',
    'maxLength',
    'required',
    'email',
    'url',
    'minLength',
    'min',
    'max',
    'pattern',
    'maxFiles',
  ].map((id) => ({
    id: `form.rule.${id}`,
    route: 'form-behaviors' as const,
    title: `驗證規則 ${id}`,
    kind: 'rules',
    steps: ruleSteps(id),
    expected: '無效原始文字能進入表單並觸發翻譯訊息；所有規則有對應可輸入控制。',
  })),
  ...[
    'picker-hydrate-authority',
    'picker-nested-lifetime',
    'picker-large-selection',
    'picker-single-multiple',
  ].map((id) => ({
    id: `relation.${id}`,
    route: 'form-behaviors' as const,
    title:
      {
        'picker-hydrate-authority': '已選商品權威載入',
        'picker-nested-lifetime': '巢狀挑選生命週期',
        'picker-large-selection': '101 項已選商品',
        'picker-single-multiple': '關聯單選與多選',
      }[id] ?? id,
    kind: id,
    steps:
      id === 'picker-large-selection'
        ? [
            '查看初始101項已存商品，核對商品101標籤與最後一項權威值。',
            '點「載入101項已選商品」重載，觀察 hydrate 批次 100、1；這是既有 owner 的 canonical snapshot，未宣稱101個新增 owner 的效能。',
          ]
        : id === 'picker-nested-lifetime'
          ? [
              '啟用慢速請求，在外層列開啟巢狀商品；等待回應前刪除此列再新增列。',
              '另開多選商品，在商品附加欄位中開啟巢狀商品，取消前後切換並核對草稿。',
            ]
          : [
              '開啟單選商品，選商品2後套用；再開啟多選商品。',
              '比較商品1唯讀備註、商品2可編輯必填備註與權威對照；修正後套用，取消則保留原草稿。',
            ],
    expected:
      id === 'picker-large-selection'
        ? '101項標籤皆可見，批次大小不超過100；初始 rowFields 與權威值在載入後保留。'
        : '單選為 null/item、多選為 item[]；來源 rowFields 改變可編輯性與規則，畫面仍顯示草稿，權威值另列於對照；刪列後遲到回應不能污染新列。',
  })),
  ...['error-cancel', 'limits', 'nested-memory'].map((id) => ({
    id: `upload.${id}`,
    route: 'form-behaviors' as const,
    title:
      {
        'error-cancel': '附件失敗、取消與重試',
        limits: '附件格式、大小與數量限制',
        'nested-memory': '巢狀附件草稿',
      }[id] ?? id,
    kind: 'upload',
    steps: [
      '選擇文字檔：小於1KB、最多2個；圖片觸發格式錯誤，超過1KB觸發大小錯誤，第三檔觸發數量錯誤。',
      '切換上傳失敗後加入檔案；移除錯誤列，切換成功再加入。慢速模式下移除進度列可取消。',
      '在 JSON 列、關聯列與商品附加欄位加入附件、調整排序，再刪除／新增列核對。',
    ],
    expected:
      '顯示各別錯誤與不定進度；取消回應不回填已刪列。只模擬暫存 token，資料庫附件清理須依後端工作台契約驗證。',
  })),
];
function behaviorSteps(id: string): string[] {
  if (id === 'server422')
    return [
      '在「名稱」填入待驗證文字，將「模擬回應」選為「422 欄位錯誤」，按「儲存後繼續編輯」。',
      '觀察名稱欄位的「此名稱已被使用。」與錯誤焦點；將模擬回應選回「成功」，修正名稱後重新儲存。',
    ];
  if (id === 'client-rule-message')
    return [
      '清空必填文字後儲存，查看 ClientRule 的「請填寫名稱。」。',
      '填入名稱，將模擬回應選422後儲存，同一欄位顯示「此名稱已被使用。」；unique等未支援規則不傳到前端，這裡只模擬後端422回應。',
    ];
  if (id.startsWith('submit-'))
    return [
      '修改名稱，選擇模擬回應；失敗或取消時核對草稿仍在。',
      '改成成功後點對應儲存去向；列表、檢視與空白新增表單都在本頁記憶體操作。',
    ];
  if (id === 'readonly-disabled')
    return [
      '比較可編輯、唯讀、停用與畫面不可見的 hidden 欄位。',
      '按儲存，比較整份 wire 草稿與模擬接受值；欄位狀態不是請求安全邊界。',
    ];
  if (id === 'default-value')
    return [
      '新增列保持空白可編輯草稿；關閉「編輯列備註」，比較實際列權威值中的新 owner fallback。',
      '切回啟用時草稿仍空白；停用時儲存採用權威 fallback，既有 owner 保留已存基準。',
    ];
  if (id.startsWith('custom'))
    return [
      '比較根層地址、列內地址、唯讀、停用與純顯示地址。',
      '點「載入地址錯誤」，修正根層或列內 county，查看相對錯誤清除。',
    ];
  return [
    '切換控制開關與列內類型，觀察欄位啟用與顯示的差異。',
    '點「載入無效控制值」後儲存，檢查控制值錯誤與保守必填驗證；重設後重試。',
  ];
}
function behaviorExpected(id: string) {
  if (id === 'server422')
    return '名稱顯示「此名稱已被使用。」且草稿保留；選擇成功並修正後可重試，接受值更新、錯誤清除。';
  return id.startsWith('submit-')
    ? '成功後採用記憶體端點重新載入的完整基準；取消、422 與網路錯誤保持草稿，可重試。'
    : id === 'default-value'
      ? 'defaultValue 不初始化草稿；模擬儲存時只補新 owner 缺值。'
      : id === 'readonly-disabled'
        ? 'wire 含整份草稿；模擬接受值保留唯讀／停用／displayOnly 的基準，hidden 仍提交。這不是後端授權證據。'
        : '可見性、可編輯性、錯誤路徑與草稿皆可直接核對；資料只存本頁記憶體。';
}

function ruleSteps(id: string): string[] {
  const cases: Record<string, [string, string, string]> = {
    integer: ['整數文字', '1.5', '2'],
    numeric: ['數值文字', 'abc', '2.5'],
    maxLength: ['短文字', 'abcdef', 'abc'],
    required: ['必填文字', '清空文字', '可用名稱'],
    email: ['郵件文字', 'abc', 'demo@example.test'],
    url: ['網址文字', 'abc', 'https://example.test'],
    minLength: ['至少兩字', '字', '文字'],
    min: ['一到十', '0', '1'],
    max: ['一到十', '11', '10'],
    pattern: ['大寫代碼', 'abc', 'ABC'],
    maxFiles: ['附件', '加入兩個小於1KB的文字檔', '移除其中一個附件'],
  };
  const [label, bad, good] = cases[id] ?? ['整數文字', '1.5', '2'];
  return [
    `在「${label}」輸入或操作「${bad}」，按儲存觀察對應錯誤。`,
    `改成「${good}」後重新儲存，核對實際請求與接受值。`,
  ];
}
