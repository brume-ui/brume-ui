import type { Condition, FieldDef, FormDef, FormNode } from '@brume-ui/brume-schema';
import {
  address,
  FIELD_EXAMPLES,
  FORM_EXAMPLES,
  node,
  opts,
  text,
  UPLOAD_PRESETS,
  upload,
} from './form-feature-data';

const eq = (path: string, value: string | boolean, scope: 'root' | 'row' = 'root'): Condition => ({
  op: 'eq',
  field: { scope, path },
  value,
});
const ruleFields: FieldDef[] = [
  { ...text('integer', '整數文字'), rules: [{ rule: 'integer', message: '請輸入整數。' }] },
  { ...text('numeric', '數值文字'), rules: [{ rule: 'numeric', message: '請輸入數值。' }] },
  { ...text('short', '短文字'), rules: [{ rule: 'maxLength', value: 5, message: '最多五個字。' }] },
  { ...text('required', '必填文字'), rules: [{ rule: 'required', message: '請填寫名稱。' }] },
  { ...text('email', '郵件文字'), rules: [{ rule: 'email', message: '請輸入有效郵件。' }] },
  { ...text('url', '網址文字'), rules: [{ rule: 'url', message: '請輸入有效網址。' }] },
  {
    ...text('long', '至少兩字'),
    rules: [{ rule: 'minLength', value: 2, message: '至少兩個字。' }],
  },
  {
    ...text('range', '一到十'),
    rules: [
      { rule: 'min', value: 1, message: '最小為一。' },
      { rule: 'max', value: 10, message: '最大為十。' },
    ],
  },
  {
    ...text('pattern', '大寫代碼'),
    rules: [{ rule: 'pattern', pattern: '^[A-Z]+$', message: '只允許大寫。' }],
  },
  { ...upload, rules: [{ rule: 'maxFiles', value: 1, message: '最多一個已完成附件。' }] },
];
export function buildFocusedFixture(id: string): {
  form: FormDef;
  values: Record<string, unknown>;
} {
  const example = FORM_EXAMPLES.find((x) => x.id === id);
  if (!example) throw new Error(`Unknown focused form example: ${id}`);
  const form: FormDef = { layout: 'stacked', nodes: [] };
  let values: Record<string, unknown> = { name: '原始名稱' };
  if (example.kind === 'upload-preset') {
    const preset = UPLOAD_PRESETS.find((x) => x.id === id);
    if (!preset) throw new Error('Missing upload preset');
    form.nodes = [node(preset.field)];
    values = { files: preset.field.multiple ? [] : null };
  } else if (example.kind === 'field') {
    const f = FIELD_EXAMPLES.find((x) => `form.field.${x.field.type}` === id);
    if (!f) throw new Error(`Missing focused field: ${id}`);
    form.nodes = [node(f.field)];
    values = { [f.field.name]: structuredClone(f.value) };
  } else if (example.kind === 'layout') {
    const city = node({
      ...text('city', '城市'),
      required: true,
      rules: [{ rule: 'required', message: '請填寫城市。' }],
    });
    const embed: FormNode = {
      type: 'embeds',
      name: 'address',
      label: '地址物件',
      children: [city],
    };
    const content: FormNode[] = [
      {
        type: 'row',
        children: [
          { type: 'field', field: { ...text('first', '名字'), width: 4 } },
          { type: 'field', field: { ...text('last', '姓氏'), width: 8 } },
        ],
      },
      {
        type: 'columns',
        columns: [
          { width: 4, children: [node(text('left', '左欄'))] },
          {
            width: 8,
            children: [
              { type: 'block', title: '右側卡片', children: [node(text('right', '右欄'))] },
            ],
          },
        ],
      },
      { type: 'divider', label: '地址資料' },
      embed,
    ];
    form.nodes = [
      { type: 'section', key: 'basic', title: '基本分段', children: [node(text('name', '名稱'))] },
      { type: 'section', key: 'address', title: '地址分段', children: content },
    ];
    form.sections = id.endsWith('tabs') ? 'tabs' : 'stack';
    form.layout = id.endsWith('horizontal') ? 'horizontal' : 'stacked';
    values = { name: '範例', address: { city: '' } };
  } else if (example.kind === 'rules' || example.kind === 'client-rule-message') {
    form.nodes = ruleFields.map(node);
    values = {
      integer: '2',
      numeric: '2.5',
      short: 'abc',
      required: '可用名稱',
      email: 'demo@example.test',
      url: 'https://example.test',
      long: '文字',
      range: '5',
      pattern: 'ABC',
      files: [],
    };
  } else if (example.kind.startsWith('custom')) {
    form.nodes = [
      node(address),
      node({ ...address, name: 'readonly', label: '唯讀地址', readOnly: true }),
      node({ ...address, name: 'disabled', label: '停用地址', disabled: true }),
      node({ ...address, name: 'display', label: '純顯示地址', displayOnly: true }),
      node({
        type: 'repeater',
        name: 'rows',
        label: '地址列',
        mode: 'json',
        nodes: [node(address)],
      }),
    ];
    const a = { county: '臺北', zipcode: '100', district: '中正', address: '範例路' };
    values = {
      address: { ...a },
      readonly: { ...a },
      disabled: { ...a },
      display: { ...a },
      rows: [{ _brume: { key: 'a' }, address: { ...a } }],
    };
  } else if (example.kind === 'readonly-disabled') {
    form.nodes = [
      node(text('name', '名稱')),
      node({ ...text('readonly', '唯讀文字'), readOnly: true }),
      node({ ...text('disabled', '停用文字'), disabled: true }),
      node({ type: 'hidden', name: 'hidden', label: '隱藏值' }),
      node({ type: 'display', name: 'display', label: '建立時間' }),
    ];
    values = {
      name: '可編輯',
      readonly: '權威唯讀',
      disabled: '權威停用',
      hidden: 'hidden-token-42',
      display: '2026-11-01',
    };
  } else if (example.kind === 'default-value') {
    form.nodes = [
      node({ type: 'switch', name: 'editNotes', label: '編輯列備註' }),
      node({
        type: 'repeater',
        name: 'rows',
        label: '預設值列',
        mode: 'relation',
        nodes: [
          node({
            ...text('note', '列備註'),
            defaultValue: '新 owner fallback',
            enableWhen: eq('editNotes', true),
          }),
        ],
      }),
    ];
    values = { editNotes: true, rows: [{ _brume: { key: 'old', id: '42' }, note: '既有草稿' }] };
  } else if (example.kind === 'upload') {
    const r = (name: string, mode: 'json' | 'relation'): FieldDef => ({
      type: 'repeater',
      name,
      label: mode === 'json' ? 'JSON 附件列' : '關聯附件列',
      mode,
      sortable: true,
      nodes: [node(upload)],
    });
    form.nodes = [
      node(upload),
      node(r('json', 'json')),
      node(r('related', 'relation')),
      node(relation('selection', true, [node(upload)])),
    ];
    values = {
      files: [],
      json: [{ _brume: { key: 'j' }, files: [] }],
      related: [{ _brume: { key: 'r', id: '42' }, files: [] }],
      selection: [{ id: '1', files: [] }],
    };
  } else if (example.kind === 'picker-large-selection') {
    form.nodes = [
      node(
        relation(
          'selection',
          true,
          [node({ ...text('locked', '商品唯讀'), readOnly: true })],
          true,
        ),
      ),
    ];
    form.rowFields = Array.from({ length: 101 }, (_, i) => ({
      row: [{ path: 'selection', key: String(i + 1), id: String(i + 1) }],
      fields: { locked: { readOnly: true, rules: [] } },
    }));
    values = {
      selection: Array.from({ length: 101 }, (_, i) => ({
        id: String(i + 1),
        locked: `權威 ${i + 1}`,
      })),
    };
  } else if (example.kind.startsWith('picker-')) {
    form.nodes = [
      node(relation('single', false)),
      node(
        relation(
          'selection',
          true,
          [
            node({ ...text('note', '商品備註'), defaultValue: '新商品預設' }),
            ...(example.kind === 'picker-nested-lifetime' ? [node(relation('nested', false))] : []),
            node({
              ...text('locked', '商品唯讀'),
              readOnly: true,
              defaultValue: '新 owner fallback',
            }),
          ],
          true,
        ),
      ),
      node({
        type: 'repeater',
        name: 'rows',
        label: '外層列',
        mode: 'json',
        nodes: [node(relation('nested', false))],
      }),
    ];
    values = {
      single: null,
      selection: [],
      rows: [{ _brume: { key: 'a' }, nested: { id: '2' } }],
    };
  } else if (
    ['conditions', 'enable-when', 'conditions-row', 'condition-invalid-control'].includes(
      example.kind,
    )
  ) {
    const type: FieldDef = {
      type: 'select',
      name: 'type',
      label: '類型',
      options: [
        { value: 'product', label: '商品' },
        { value: 'coupon', label: '優惠券' },
        { value: 'points', label: '點數' },
      ],
      rules: [{ rule: 'pattern', pattern: '^(product|coupon|points)$', message: '類型不合法。' }],
    };
    const c = eq('type', 'coupon');
    const active = eq('active', true);
    const conditions: Record<string, Condition> = {
      eq: c,
      ne: { op: 'ne', field: { scope: 'root', path: 'type' }, value: 'coupon' },
      in: { op: 'in', field: { scope: 'root', path: 'type' }, values: ['coupon', 'points'] },
      empty: { op: 'empty', field: { scope: 'root', path: 'empty' } },
      all: { op: 'all', conditions: [c, active] },
      any: { op: 'any', conditions: [c, active] },
      not: { op: 'not', condition: c },
    };
    form.nodes = [
      node(type),
      node({ type: 'switch', name: 'active', label: '啟用' }),
      node(text('empty', '空值控制')),
      node({ type: 'hidden', name: 'nullable', label: 'null 控制值' }),
      node({ type: 'multipleSelect', name: 'emptyArray', label: '空陣列控制', options: opts }),
      ...Object.entries(conditions).map(([op, showWhen]) =>
        node({ ...text(`condition_${op}`, `${op} 條件欄位`), showWhen }),
      ),
      node({
        ...text('nullEmpty', 'null empty 條件欄位'),
        showWhen: { op: 'empty', field: { scope: 'root', path: 'nullable' } },
      }),
      node({
        ...text('arrayEmpty', 'array empty 條件欄位'),
        showWhen: { op: 'empty', field: { scope: 'root', path: 'emptyArray' } },
      }),
      node({ ...text('enabled', '依啟用開關編輯'), enableWhen: active }),
      node({
        ...text('requiredCoupon', '優惠券必填'),
        required: true,
        showWhen: c,
        rules: [{ rule: 'required', message: '優惠券必填。' }],
      }),
      node({
        type: 'repeater',
        name: 'rows',
        label: '條件列',
        mode: 'json',
        nodes: [
          node({ ...type, label: '列內類型' }),
          node({ ...text('rowNote', '列內優惠券備註'), showWhen: eq('type', 'coupon', 'row') }),
          node({ ...text('rootNote', '根層啟用備註'), enableWhen: active }),
        ],
      }),
    ];
    values = {
      type: 'product',
      active: false,
      empty: '',
      nullable: null,
      emptyArray: [],
      enabled: '保留草稿',
      requiredCoupon: '',
      rows: [
        { _brume: { key: 'a' }, type: 'coupon', rowNote: '甲列草稿' },
        { _brume: { key: 'b' }, type: 'points', rowNote: '乙列草稿' },
      ],
    };
  } else
    form.nodes = [
      node({ ...text('name', '名稱'), rules: [{ rule: 'required', message: '請填寫名稱。' }] }),
    ];
  return { form, values };
}
function relation(
  name: string,
  multiple: boolean,
  fields: FormNode[] = [],
  hydrateAuthority?: true,
): FieldDef {
  return {
    type: 'relation',
    name,
    label: name === 'single' ? '單選商品' : name === 'nested' ? '巢狀商品' : '多選商品',
    multiple,
    remote: { url: '/demo/focused/options' },
    fields,
    ...(hydrateAuthority ? { hydrateAuthority } : {}),
  };
}
