import type { FieldDef, FormNode } from '@brume-ui/brume-schema';

/** Invented placeholder answer of the static demo image `public/demo/captcha.svg`. */
export const CAPTCHA_ANSWER = 'A7K9';
export const CAPTCHA_SRC = '/demo/captcha.svg';

const field = (def: FieldDef): FormNode => ({ type: 'field', field: def });

export const ipField: FieldDef = { type: 'ip', name: 'value', label: '伺服器位址' };
export const rateField: FieldDef = {
  type: 'rate',
  name: 'value',
  label: '折扣率',
  decimals: 1,
  min: 0,
  max: 100,
  rules: [
    { rule: 'min', value: 0, message: '不可小於 0。' },
    { rule: 'max', value: 100, message: '不可大於 100。' },
  ],
};
export const sliderField: FieldDef = {
  type: 'slider',
  name: 'value',
  label: '音量',
  min: 0,
  max: 100,
  step: 5,
};
export const rangeField: FieldDef = {
  type: 'range',
  name: 'value',
  label: '重量範圍',
  decimals: 1,
};
export const iconField: FieldDef = { type: 'icon', name: 'value', label: '選單圖示' };
export const timeField: FieldDef = { type: 'time', name: 'value', label: '營業開始' };
export const timeRangeField: FieldDef = { type: 'timeRange', name: 'value', label: '營業時段' };
export const captchaField: FieldDef = {
  type: 'captcha',
  name: 'code',
  label: '驗證碼',
  src: CAPTCHA_SRC,
  required: true,
  rules: [{ rule: 'required', message: '請輸入驗證碼。' }],
};

/** Focused fixtures with more than the single default field (ids are `form.field.<type>`). */
export const SMALL_FIELD_FIXTURES: Record<
  string,
  { nodes: FormNode[]; values: Record<string, unknown> }
> = {
  'form.field.ip': {
    nodes: [
      field(ipField),
      field({ type: 'ip', name: 'v4', label: '僅 IPv4', version: 4 }),
      field({ type: 'ip', name: 'v6', label: '僅 IPv6', version: 6 }),
    ],
    values: { value: '192.168.1.10', v4: null, v6: '2001:db8::8a2e:370:7334' },
  },
  'form.field.slider': {
    nodes: [
      field(sliderField),
      field({ type: 'slider', name: 'ratio', label: '比例', min: 0, max: 1, step: 0.1 }),
      field({
        type: 'slider',
        name: 'level',
        label: '必填等級',
        min: 10,
        max: 50,
        step: 10,
        required: true,
      }),
    ],
    values: { value: 30, ratio: 0.3, level: null },
  },
  'form.field.time': {
    nodes: [
      field(timeField),
      field({ type: 'time', name: 'precise', label: '含秒數', seconds: true }),
    ],
    values: { value: '09:05', precise: '09:05:30' },
  },
  'form.field.timeRange': {
    nodes: [field(timeRangeField)],
    values: { value: { start: '22:00', end: '06:00' } },
  },
  'form.field.captcha': {
    nodes: [
      field({ type: 'text', name: 'name', label: '留言者', required: true }),
      field(captchaField),
    ],
    values: { name: '示範訪客', code: null },
  },
};

/** The `button` layout node of the focused layout demo: one in-app link, one external link. */
export const BUTTON_DEMO: FormNode[] = [
  { type: 'button', label: '前往站內說明', href: '/admin/help' },
  {
    type: 'button',
    label: '開啟外部公告',
    href: 'https://example.com/policy',
    newTab: true,
    variant: 'secondary',
  },
];

export const SMALL_FIELD_GUIDES: Record<string, { steps: string[]; expected: string }> = {
  ip: {
    steps: [
      '在「伺服器位址」輸入 192.168.1.10、::1 或 ::ffff:192.0.2.1 後儲存。',
      '改輸入 256.1.1.1、01.2.3.4、[::1] 或 1.2.3.4/24；「僅 IPv4」輸入 ::1，「僅 IPv6」輸入 1.2.3.4。',
    ],
    expected: '合法位址去除前後空白後儲存，空白為 null；不合法的文字顯示錯誤且不送出請求。',
  },
  rate: {
    steps: ['在「折扣率」輸入 12.5，欄位尾端顯示 %。', '改輸入 101 或 abc 再儲存。'],
    expected: '儲存值是不含千分位的十進位字串；超出 0 到 100 的範圍或不是數字的值顯示錯誤。',
  },
  slider: {
    steps: [
      '以 Tab 聚焦「音量」滑桿，按方向鍵、Home、End 改值。',
      '「必填等級」沒有值時滑桿停在最小值 10；不動任何欄位，表單不算有未儲存變更，儲存會送出 10。',
    ],
    expected: '值是數字並對齊 min + k × step；0.3（步進 0.1）不因浮點誤差被拒絕。',
  },
  range: {
    steps: [
      '在「重量範圍」輸入起點 1.5、終點 4 後儲存。',
      '改成起點 5、終點 4，或只填一端，或輸入 1.25（超過位數）、abc。',
    ],
    expected: '起點大於終點時錯誤出現在終點欄；兩端各自為十進位字串或空白。',
  },
  icon: {
    steps: [
      '按「選單圖示」旁的圖示按鈕，在搜尋框輸入 user，用方向鍵移動並按 Enter 選取。',
      '按 Esc 關閉，焦點回到按鈕；按「在彈窗中編輯」，確認選擇器在彈窗內可搜尋、鍵盤操作並以滑鼠滾輪捲動。',
    ],
    expected: '儲存值是 kebab-case 的 lucide 圖示名稱或 null；畫面最多顯示 120 個結果。',
  },
  time: {
    steps: ['在「營業開始」輸入 09:05 後儲存。', '「含秒數」欄位顯示並保留 09:05:30。'],
    expected: '值為 HH:mm（含秒數欄位為 HH:mm:ss）；瀏覽器的時間控制項只接受 24 小時制的合法時間。',
  },
  timeRange: {
    steps: ['查看預設的 22:00 到 06:00 並儲存。', '改成 09:00 到 18:00 再儲存。'],
    expected: '跨夜時段合法，不強制起點早於終點；兩端各自為 HH:mm。',
  },
  captcha: {
    steps: [
      '按驗證碼圖片旁的重新整理按鈕，觀察圖片網址的 r 參數改變。',
      '輸入錯誤答案後儲存，模擬伺服器回 422；輸入 A7K9 後儲存成功。',
    ],
    expected:
      '每次失敗的送出都會換圖並清空答案；驗證碼答案不會寫入已儲存的資料。圖片是固定的示意圖，不是真正的驗證碼。',
  },
};
