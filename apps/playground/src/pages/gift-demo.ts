import { createMemoryAdapter, type HttpRequest, type HttpResponse } from '@brume-ui/brume-react';
import type { Condition, FieldDef, FormDef, FormSubmitRequest } from '@brume-ui/brume-schema';
import { acceptConditionalDraft } from './form-feature-memory';

export type GiftType = 'product' | 'coupon' | 'points';
const field = (field: FieldDef) => ({ type: 'field' as const, field });
const required = (message: string) => ({ rule: 'required' as const, message });
const positiveInteger = [
  required('請輸入正整數。'),
  { rule: 'integer' as const, message: '請輸入正整數。' },
  { rule: 'min' as const, value: 1, message: '請輸入正整數。' },
];

/** Conditions belong to fields; row scope means the current threshold, never its siblings. */
export function giftFields(scope: 'root' | 'row'): FieldDef[] {
  const show = (value: GiftType): Condition => ({
    op: 'eq',
    field: { scope, path: 'gift_type' },
    value,
  });
  return [
    {
      type: 'radio',
      name: 'gift_type',
      label: '贈品類型',
      defaultValue: 'product',
      required: true,
      options: [
        { value: 'product', label: '商品' },
        { value: 'coupon', label: '優惠券' },
        { value: 'points', label: '點數' },
      ],
      rules: [
        required('請選擇贈品類型。'),
        {
          rule: 'pattern',
          pattern: '^(product|coupon|points)$',
          message: '贈品類型必須是商品、優惠券或點數。',
        },
      ],
    },
    {
      type: 'relation',
      name: 'gifts',
      label: '贈品商品',
      multiple: true,
      remote: { url: scope === 'row' ? '/composition/picker' : '/gift/picker' },
      showWhen: show('product'),
      required: true,
      rules: [required('請選擇至少一件商品。')],
      fields: [
        field({
          type: 'number',
          name: 'quantity',
          label: '贈品數量',
          min: 1,
          step: 1,
          required: true,
          rules: positiveInteger,
        }),
      ],
    },
    {
      type: 'text',
      name: 'coupon_code',
      label: '優惠券代碼',
      showWhen: show('coupon'),
      required: true,
      rules: [required('請輸入優惠券代碼。')],
    },
    {
      type: 'currency',
      name: 'coupon_amount',
      label: '優惠券金額',
      decimals: 2,
      showWhen: show('coupon'),
      required: true,
      rules: [
        required('請輸入優惠券金額。'),
        { rule: 'pattern', pattern: '^\\d+\\.\\d{2}$', message: '金額須為小數兩位的精確字串。' },
        { rule: 'min', value: 0.01, message: '金額必須大於零。' },
      ],
    },
    {
      type: 'datetime',
      name: 'coupon_expires_at',
      label: '優惠券到期時間',
      showWhen: show('coupon'),
      required: true,
      rules: [required('請輸入優惠券到期時間。')],
    },
    {
      type: 'number',
      name: 'points',
      label: '贈送點數',
      min: 1,
      step: 1,
      showWhen: show('points'),
      required: true,
      rules: positiveInteger,
    },
    { type: 'textarea', name: 'points_note', label: '點數備註', showWhen: show('points') },
  ];
}
export const giftForm: FormDef = { layout: 'stacked', nodes: giftFields('root').map(field) };

export function giftValues(suffix = 'ROOT') {
  return {
    gift_type: 'product' as GiftType,
    gifts: [{ id: '1', quantity: 2 }],
    coupon_code: `STORED-${suffix}`,
    coupon_amount: '10.00',
    coupon_expires_at: '2030-12-31T18:00:00',
    points: 100,
    points_note: `既存點數備註 ${suffix}`,
  };
}

/** Memory simulation only. The wire remains the full draft; inactive stored owners are retained. */
export function createGiftMemory(form: FormDef, initial: Record<string, unknown>) {
  const store = { saved: structuredClone(initial), wire: {} as Record<string, unknown> };
  async function respond(request: HttpRequest): Promise<HttpResponse | undefined> {
    if (request.url === '/gift/stored' && request.method === 'get')
      return { status: 200, data: structuredClone(store.saved) };
    if (request.url === '/gift/save') {
      const { values } = request.body as FormSubmitRequest;
      store.wire = structuredClone(values);
      store.saved = acceptConditionalDraft({ form, values: initial }, values, store.saved);
      // Observable canonicalization belongs to this simulated server, never the editable draft.
      const canonicalize = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(canonicalize);
        else if (value && typeof value === 'object') {
          const row = value as Record<string, unknown>;
          if (row.gift_type === 'coupon' && typeof row.coupon_code === 'string')
            row.coupon_code = row.coupon_code.trim();
          Object.values(row).forEach(canonicalize);
        }
      };
      canonicalize(store.saved);
      return { status: 200, data: { id: 'gift-demo', urls: { edit: '/gift/edit' } } };
    }
    if (request.url === '/gift/picker') {
      const ids = request.query?.value;
      const q = String(request.query?.q ?? '');
      const options = Array.from({ length: 24 }, (_, i) => ({
        value: String(i + 1),
        label: `商品 ${i + 1}`,
      }));
      const filtered = options.filter((item) =>
        Array.isArray(ids) ? ids.includes(item.value) : item.label.includes(q),
      );
      const page = Number(request.query?.page ?? 1);
      return {
        status: 200,
        data: {
          data: Array.isArray(ids) ? filtered : filtered.slice((page - 1) * 20, page * 20),
          pagination: {
            page,
            perPage: 20,
            hasMore: !Array.isArray(ids) && filtered.length > page * 20,
          },
        },
      };
    }
    return undefined;
  }
  return {
    store,
    respond,
    adapter: createMemoryAdapter('/gift/edit', {
      respond: async (request) => (await respond(request)) ?? { status: 404, data: {} },
    }),
  };
}
