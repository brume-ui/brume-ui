import { collectValueFields, validateValue } from '@brume-ui/brume-renderer';
import type { FormDef } from '@brume-ui/brume-schema';
import { describe, expect, it } from 'vitest';
import { compositionForm, compositionInitial } from './form-composition';
import { createGiftMemory, giftFields, giftForm, giftValues } from './gift-demo';

const errors = (form: FormDef, values: Record<string, unknown>) =>
  collectValueFields(form.nodes, values)
    .filter((f) => f.active && validateValue(f.def, f.effectiveValue))
    .map((f) => f.path);
const first = <T>(rows: T[]): T => {
  const row = rows[0];
  if (!row) throw new Error('Expected row');
  return row;
};

describe('gift fixture uses public field conditions and authoritative memory snapshots', () => {
  it.each(['root', 'row'] as const)(
    'declares three closed choices with %s conditions on fields only',
    (scope) => {
      const fields = giftFields(scope);
      expect(first(fields)).toMatchObject({
        type: 'radio',
        defaultValue: 'product',
        options: [{ value: 'product' }, { value: 'coupon' }, { value: 'points' }],
      });
      for (const def of fields.slice(1))
        expect(def.showWhen).toMatchObject({ field: { scope, path: 'gift_type' } });
      const type = first(fields);
      for (const value of ['', 'cash', null, 1]) expect(validateValue(type, value)).not.toBeNull();
      for (const value of ['product', 'coupon', 'points'])
        expect(validateValue(type, value)).toBeNull();
    },
  );
  it('validates only active branches, including empty product selection and positive integer quantities/points', () => {
    const values = giftValues();
    expect(errors(giftForm, { ...values, gifts: [], points: -1, coupon_code: '' })).toEqual([
      'gifts',
    ]);
    expect(errors(giftForm, { ...values, gifts: [{ id: '1', quantity: 0 }], points: -1 })).toEqual([
      'gifts.0.quantity',
    ]);
    expect(
      errors(giftForm, {
        ...values,
        gift_type: 'coupon',
        gifts: [],
        coupon_code: '',
        coupon_amount: '',
        coupon_expires_at: '',
        points: -1,
      }),
    ).toEqual(['coupon_code', 'coupon_amount', 'coupon_expires_at']);
    expect(
      errors(giftForm, { ...values, gift_type: 'coupon', gifts: [], coupon_amount: '1.001' }),
    ).toEqual(['coupon_amount']);
    expect(
      errors(giftForm, { ...values, gift_type: 'points', gifts: [], coupon_code: '', points: 1.5 }),
    ).toEqual(['points']);
    expect(
      errors(giftForm, {
        ...values,
        gift_type: 'points',
        gifts: [],
        coupon_code: '',
        points: 2,
        points_note: '',
      }),
    ).toEqual([]);
    expect(errors(giftForm, { ...values, gift_type: 'cash' })).toContain('gift_type');
  });
  it('saves active exact-currency strings and restores inactive stored branches rather than hidden drafts', async () => {
    const memory = createGiftMemory(giftForm, giftValues());
    const draft = {
      ...giftValues(),
      gift_type: 'coupon',
      coupon_code: '  NEW-CODE  ',
      coupon_amount: '123.45',
      gifts: [{ id: '2', quantity: 99 }],
      points: 999,
      points_note: 'hidden draft',
    };
    await memory.adapter.request({
      method: 'put',
      url: '/gift/save',
      body: { values: draft, after: 'edit' },
    });
    expect(memory.store.wire).toEqual(draft);
    const loaded = await memory.adapter.request({ method: 'get', url: '/gift/stored' });
    expect(loaded.data).toEqual({
      ...giftValues(),
      gift_type: 'coupon',
      coupon_code: 'NEW-CODE',
      coupon_amount: '123.45',
    });
  });
  it('retains each complete owner through nested shifts and gives replacement owners no deleted data', async () => {
    const memory = createGiftMemory(compositionForm, compositionInitial);
    const draft = structuredClone(compositionInitial);
    const tier = first(draft.tiers);
    const h1 = first(tier.thresholds);
    const h2 = tier.thresholds[1];
    if (!h2) throw new Error('Expected second threshold');
    h2.gift_type = 'points';
    h2.points = 222;
    h2.coupon_code = 'hidden H2';
    h2.gifts = [{ id: '1', quantity: 55 }];
    tier.thresholds = [
      h2,
      {
        ...h1,
        _brume: { key: 'new-h1', id: '1' },
        gift_type: 'points',
        points: 333,
        points_note: 'new owner',
        coupon_code: 'hidden replacement',
        gifts: [{ id: '1', quantity: 99 }],
      },
    ];
    await memory.adapter.request({
      method: 'put',
      url: '/gift/save',
      body: { values: draft, after: 'edit' },
    });
    const saved = memory.store.saved as typeof compositionInitial;
    const rows = first(saved.tiers).thresholds;
    expect(first(rows)).toMatchObject({
      _brume: { key: 'h2', id: '2' },
      points: 222,
      coupon_code: 'STORED-H2',
      gifts: [{ id: '2', quantity: 3 }],
    });
    expect(rows[1]).toMatchObject({
      _brume: { key: 'new-h1', id: '1' },
      points: 333,
      coupon_code: null,
      gifts: [],
    });
  });
});
