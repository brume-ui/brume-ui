import { BACKEND_GRID_IDS, gridBackendEvidence } from './grid-backend-evidence';
export interface GridExample {
  id: string;
  title: string;
  steps: readonly string[];
  expected: string;
  backend: boolean;
}
const DISPLAY_STEPS = [
  '查看列表初始可見的目標欄位，以訂單編號對照資料。',
  '操作目標儲存格的連結、複製、下載或展開控制，核對顯示內容。',
];
const EDITOR_STEPS = [
  '點目標儲存格編輯，修改後先取消，確認原值保持。',
  '再次開啟編輯並確認儲存；比較下方原始值、格式化列與請求紀錄。',
];
function example(
  type: string,
  key: string,
  expected: string,
  steps: readonly string[],
): GridExample {
  const title = (
    { display: '顯示', editor: '編輯', input: '篩選輸入', behavior: '操作' } as Record<
      string,
      string
    >
  )[type];
  return {
    id: `grid.${type}.${key}`,
    title: `Grid ${title} · ${key}`,
    expected,
    steps,
    backend: false,
  };
}
const displays: [string, string][] = [
  ['badge', '通路徽章初始可見。'],
  ['link', '文字與按鈕連結均指向 Brume GitHub 可用 HTTPS 頁面。'],
  ['limit', '備註截斷；點完整內容圖示可開啟全文浮層。'],
  ['progress', '出貨進度依 max=100 顯示 50 或 100。'],
  ['qrcode', '取貨欄直接產生 GitHub 網址 QR Code。'],
  ['copyable', '物流單號有值；點複製後出現成功通知。'],
  ['downloadable', '兩個真實靜態 fixture 可下載：收據文字與品項 CSV。'],
  ['expand', '點展開會在列下方呈現商品、數量、小計表格。'],
  ['modal', '點查看紀錄會開啟含文字操作紀錄的彈窗。'],
  ['table', '品項儲存格直接呈現商品與數量表格。'],
  [
    'text',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'label',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'image',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'component',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
];
const editors: [string, string][] = [
  [
    'custom',
    'TaiwanAddress 可編輯；清空縣市儲存會收到 address.county 的 422，修正後顯示格式化地址。',
  ],
  ['textarea', '備註直接可編輯；超過 200 字會收到 422；取消保留原值。'],
  ['radio', '選付款方式後儲存，儲存格保留中文標籤。'],
  ['checkbox', '多選標籤陣列更新，儲存格保留中文選項標籤。'],
  ['switchGroup', '急件與開發票兩個布林 key 可獨立切換並更新。'],
  ['date', '配送日期與預約時間兩欄分別提交 YYYY-MM-DD 與 YYYY-MM-DDTHH:mm。'],
  ['currency', '將 1280.50 改為 1234.50 並確認，raw 保持兩位小數精確字串，顯示 NT$ 1234.50。'],
  ['tags', '輸入新標籤與建議值，確認後 raw 為文字陣列。'],
  [
    'text',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'number',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'select',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'switch',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
];
const inputs: [string, string, string][] = [
  [
    'selectTable',
    '點篩選打開面板；搜尋並挑選一位客戶後套用。',
    '套用後實際縮小記憶體訂單集合；清除後恢復 24 筆，並保留一般 header／門市／標籤篩選可操作。',
  ],
  [
    'multipleSelectTable',
    '點篩選打開面板；挑選兩位客戶後套用。',
    '套用後實際縮小記憶體訂單集合；清除後恢復 24 筆，並保留一般 header／門市／標籤篩選可操作。',
  ],
  [
    'date-time',
    '點篩選打開面板；選擇 2026-10-28 09:30 後套用。',
    '套用後實際縮小記憶體訂單集合；清除後恢復 24 筆，並保留一般 header／門市／標籤篩選可操作。',
  ],
  [
    'range-text',
    '點篩選打開面板；輸入起 ORD-2610010、迄 ORD-2610015；再測試僅起與僅迄。',
    '套用後實際縮小記憶體訂單集合；清除後恢復 24 筆，並保留一般 header／門市／標籤篩選可操作。',
  ],
  [
    'range-datetime',
    '點篩選打開面板；起迄選 2026-10-28 09:30，核對包含該分鐘資料。',
    '套用後實際縮小記憶體訂單集合；清除後恢復 24 筆，並保留一般 header／門市／標籤篩選可操作。',
  ],
  [
    'group-text',
    '點篩選打開面板；選 endWith 並輸入 024 後套用，再比較 equal。',
    '套用後實際縮小記憶體訂單集合；清除後恢復 24 筆，並保留一般 header／門市／標籤篩選可操作。',
  ],
  [
    'numeric',
    '點篩選打開面板；輸入訂單數字 ID 24 後套用；這是 numeric 文字輸入。',
    '套用後實際縮小記憶體訂單集合；清除後恢復 24 筆，並保留一般 header／門市／標籤篩選可操作。',
  ],
  [
    'remote-multiple',
    '點篩選打開面板；搜尋客戶並多選後套用，再開啟核對已選名稱。',
    '套用後實際縮小記憶體訂單集合；清除後恢復 24 筆，並保留一般 header／門市／標籤篩選可操作。',
  ],
  [
    'text',
    '點篩選打開面板；輸入訂單編號片段 024 後套用。',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'select',
    '點篩選打開面板；搜尋並選擇一位客戶後套用。',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'multipleSelect',
    '點篩選打開面板；搜尋並多選客戶後套用。',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'radio',
    '點篩選打開面板；選擇已付款後套用。',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'checkbox',
    '點篩選打開面板；勾選官網後套用。',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'date',
    '點篩選打開面板；選擇 2026-10-28 後套用。',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'range',
    '點篩選打開面板；輸入起 23、迄 24 後套用。',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
  [
    'group',
    '點篩選打開面板；選 gt 並輸入 20 後套用。',
    '目標功能可直接操作；儲存／篩選會改變共享記憶體記錄與結果，原始值與格式化列可在下方核對。',
  ],
];
const behaviors: [string, string, readonly string[]][] = [
  [
    'export-memory',
    'Grid 原生匯出選單以目前 query 產生真實 CSV 記憶體下載；它不是後端 Excel。欄位記憶只保存在瀏覽器。',
    [
      '先以搜尋或篩選縮小集合，選取一列，再依序操作匯出全部、目前頁與已選。',
      '核對下載的 CSV fixture 與下方 export query／列 ID；切換排序、分頁與欄位後重新整理列表。',
    ],
  ],
  [
    'action-input',
    '原因至少 3 字才儲存；取消不寫入，成功回饋並重新載入列表。',
    [
      '點列上的註記原因；輸入一字後送出以觸發 422。',
      '取消再開啟；輸入至少三字後送出並核對記憶體備註。',
    ],
  ],
  [
    'action-redirect',
    'feedback.redirect 導向可用的已付款列表；同回應的 refresh 不會再執行。',
    [
      '點工具列前往已付款列表，查看通知與結果。',
      '核對下方 visit 與 reload 次數，清除狀態 chip 返回完整集合。',
    ],
  ],
  [
    'batch-errors',
    '部分有效列會出貨並回報略過數；全部無效收到 422，範圍外 ID 收到 403 且沒有修改。',
    [
      '勾選偶數 ID（已付款）與奇數 ID（待付款），執行標記為已出貨。',
      '再只勾選待付款列重試；使用下方範圍外請求按鈕檢查伺服器拒絕。',
    ],
  ],
  [
    'resource-page',
    'resource.presentation=page 真實切換至完整表單，再返回共享記憶體列表；離開本範例重置。',
    ['點訂單編號開啟獨立編輯頁，修改客戶並儲存。', '點返回聚焦列表，核對更新後客戶名稱。'],
  ],
  [
    'editor-format',
    '選項仍顯示中文、金額仍顯示 NT$、地址仍經自訂 display；raw 保留各自型別。',
    [
      '依序編輯付款方式、精確金額、收件地址與自由標籤。',
      '儲存後比較下方 rows 與 raw，重新整理列表核對格式仍保留。',
    ],
  ],
];
/** The original source inventory IDs are retained; contracts never pretend to run SQL here. */
export const GRID_EXAMPLES: readonly GridExample[] = [
  ...displays.map(([key, expected]) => example('display', key, expected, DISPLAY_STEPS)),
  ...editors.map(([key, expected]) => example('editor', key, expected, EDITOR_STEPS)),
  ...inputs.map(([key, step, expected]) =>
    example('input', key, expected, [
      step,
      '核對下方結果列 ID 與筆數；點已套用條件的移除按鈕清除。',
    ]),
  ),
  ...behaviors.map(([key, expected, steps]) => example('behavior', key, expected, steps)),
  ...BACKEND_GRID_IDS.map((id) => ({
    id,
    title: `Grid 資料庫契約 · ${id.split('.').at(-1)}`,
    backend: true,
    steps: [
      '查看下方公開 workbench 路徑、篩選 query 與對應 PHP 結果測試。',
      '在隔離 workbench 開啟路徑並套用條件；清除後比較結果集合。',
    ],
    expected: `${gridBackendEvidence(id).expected} 本地證據為 SQLite；MySQL／PostgreSQL 尚待各自環境驗證。`,
  })),
];
