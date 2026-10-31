import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormCompositionPage } from '../../../apps/playground/src/pages/form-composition';
import { FormConditionsPage, GiftForm } from '../../../apps/playground/src/pages/form-conditions';
import {
  createGiftMemory,
  giftForm,
  giftValues,
} from '../../../apps/playground/src/pages/gift-demo';
import { renderWithBrume } from './test-utils';

const first = <T,>(rows: T[]): T => {
  const row = rows[0];
  if (!row) throw new Error('Expected row');
  return row;
};
const output = (name: string) => JSON.parse(screen.getByTestId(name).textContent || '{}');
const change = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(new RegExp(`^${name}`)), { target: { value } });
const save = (composition = false) =>
  fireEvent.click(
    screen.getByRole('button', {
      name: composition ? 'Save composition' : '儲存贈品設定',
    }),
  );
const type = (name: string) => fireEvent.click(screen.getByRole('radio', { name }));
const thresholds = () =>
  Array.from(screen.getByRole('list', { name: 'Thresholds' }).children) as HTMLElement[];
const rowType = (row: HTMLElement, name: string) =>
  fireEvent.click(within(row).getByRole('radio', { name }));

describe('standalone gift Form', () => {
  it('reveals only its radio branch and retains A→B→A drafts until canonical save/reset', async () => {
    renderWithBrume(<FormConditionsPage />);
    expect(screen.queryByLabelText(/^優惠券代碼/)).toBeNull();
    expect(screen.queryByLabelText(/^贈送點數/)).toBeNull();
    type('優惠券');
    expect(screen.queryByRole('button', { name: /贈品商品/ })).toBeNull();
    change('優惠券代碼', '  COUPON-DRAFT  ');
    type('點數');
    change('贈送點數', '250');
    change('點數備註', 'active note');
    type('優惠券');
    expect(screen.getByLabelText(/^優惠券代碼/)).toHaveProperty('value', '  COUPON-DRAFT  ');
    type('點數');
    save();
    await screen.findByText('已儲存並載入完整基準');
    expect(output('gift-wire')).toMatchObject({ coupon_code: '  COUPON-DRAFT  ', points: 250 });
    expect(output('gift-saved')).toMatchObject({
      coupon_code: 'STORED-ROOT',
      points: 250,
      points_note: 'active note',
      gifts: [{ id: '1', quantity: 2 }],
    });
    expect(screen.getByTestId('gift-dirty').textContent).toBe('無未儲存變更');
    type('優惠券');
    expect(screen.getByLabelText(/^優惠券代碼/)).toHaveProperty('value', 'STORED-ROOT');
    change('優惠券代碼', 'discard');
    fireEvent.click(screen.getByRole('button', { name: '重設贈品草稿' }));
    expect(screen.queryByLabelText(/^優惠券代碼/)).toBeNull();
    expect(screen.getByLabelText(/^點數備註/)).toHaveProperty('value', 'active note');
  });
  it('blocks blank active coupon/points, ignores hidden invalid drafts and canonicalizes successful coupon data', async () => {
    renderWithBrume(<FormConditionsPage />);
    type('優惠券');
    change('優惠券代碼', '');
    change('優惠券金額', '');
    change('優惠券到期時間', '');
    save();
    expect(screen.getAllByText('請輸入優惠券代碼。').length).toBeGreaterThan(0);
    expect(output('gift-saved')).toEqual({});
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '儲存贈品設定' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    type('點數');
    change('贈送點數', '');
    save();
    expect(screen.getAllByText('請輸入正整數。').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '儲存贈品設定' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    type('優惠券');
    change('優惠券代碼', '  COUPON-OK  ');
    change('優惠券金額', '123.45');
    change('優惠券到期時間', '2031-01-02T03:04');
    save();
    await screen.findByText('已儲存並載入完整基準');
    expect(screen.getByLabelText(/^優惠券代碼/)).toHaveProperty('value', 'COUPON-OK');
    expect(output('gift-saved')).toMatchObject({ coupon_amount: '123.45', points: 100 });
    expect(output('gift-draft')).toEqual(output('gift-saved'));
    change('優惠券代碼', 'draft after save');
    fireEvent.click(screen.getByRole('button', { name: '重設贈品草稿' }));
    expect(screen.getByLabelText(/^優惠券代碼/)).toHaveProperty('value', 'COUPON-OK');
  });
  it('uses the actual product picker, blocks an empty active relation, persists quantity and isolates cancelled picker extras', async () => {
    renderWithBrume(<FormConditionsPage />);
    fireEvent.click(screen.getByRole('button', { name: /贈品商品/ }));
    const picker = screen.getByRole('region', { name: '贈品商品' });
    const selection = await within(picker).findByRole('checkbox', {
      name: '選取 商品 1',
    });
    fireEvent.click(selection);
    fireEvent.click(within(picker).getByRole('button', { name: '套用' }));
    save();
    expect(screen.getAllByText('請選擇至少一件商品。').length).toBeGreaterThan(0);
    // Error focus may reveal the picker; it owns its own unapplied selection draft.
    if (!screen.queryByRole('region', { name: '贈品商品' }))
      fireEvent.click(screen.getByRole('button', { name: /贈品商品/ }));
    const open = screen.getByRole('region', { name: '贈品商品' });
    fireEvent.click(await within(open).findByRole('checkbox', { name: '選取 商品 2' }));
    fireEvent.change(within(open).getByLabelText(/^贈品數量/), { target: { value: '4' } });
    fireEvent.click(within(open).getByRole('button', { name: '套用' }));
    type('優惠券');
    type('商品');
    save();
    await screen.findByText('已儲存並載入完整基準');
    expect(output('gift-saved').gifts).toEqual([{ id: '2', quantity: 4 }]);
    fireEvent.click(screen.getByRole('button', { name: /贈品商品/ }));
    const again = screen.getByRole('region', { name: '贈品商品' });
    fireEvent.change(within(again).getByLabelText(/^贈品數量/), { target: { value: '88' } });
    fireEvent.click(within(again).getByRole('button', { name: '取消' }));
    expect(output('gift-draft').gifts).toEqual([{ id: '2', quantity: 4 }]);
  });
  it('rejects a loaded invalid gift type and permits radio repair', async () => {
    renderWithBrume(<FormConditionsPage />);
    fireEvent.click(screen.getByRole('button', { name: '載入無效贈品類型' }));
    save();
    expect(screen.getAllByText('贈品類型必須是商品、優惠券或點數。').length).toBeGreaterThan(0);
    expect(output('gift-saved')).toEqual({});
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '儲存贈品設定' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    type('點數');
    save();
    await screen.findByText('已儲存並載入完整基準');
    expect(output('gift-saved').gift_type).toBe('points');
  });
});

describe('nested threshold gifts', () => {
  it('gives two thresholds independent three-choice gift radios', () => {
    renderWithBrume(<FormCompositionPage />);
    const rows = thresholds();
    expect(rows).toHaveLength(2);
    const one = first(rows);
    const two = rows[1];
    if (!two) throw new Error('Missing second row');
    rowType(one, '優惠券');
    rowType(two, '點數');
    expect(within(one).getByLabelText(/^優惠券代碼/)).toHaveProperty('value', 'STORED-H1');
    expect(within(one).queryByLabelText(/^贈送點數/)).toBeNull();
    expect(within(two).getByLabelText(/^贈送點數/)).toHaveProperty('value', '100');
    expect(within(two).queryByLabelText(/^優惠券代碼/)).toBeNull();
  });
  it('keeps applied product extras local to their threshold across switching and sorting', async () => {
    renderWithBrume(<FormCompositionPage />);
    const rows = thresholds();
    const one = first(rows);
    const two = rows[1];
    if (!two) throw new Error('Expected second threshold');
    for (const [row, quantity] of [
      [one, '5'],
      [two, '7'],
    ] as const) {
      fireEvent.click(within(row).getByRole('button', { name: /贈品商品/ }));
      const picker = within(row).getByRole('region', { name: '贈品商品' });
      await within(picker).findByRole('checkbox', { name: /A product 1$/ });
      fireEvent.change(within(picker).getByLabelText(/^贈品數量/), { target: { value: quantity } });
      fireEvent.click(within(picker).getByRole('button', { name: '套用' }));
    }
    rowType(one, '優惠券');
    rowType(one, '商品');
    expect(
      output('gift-draft').tiers[0].thresholds.map((row: { gifts: unknown }) => row.gifts),
    ).toEqual([[{ id: '1', quantity: 5 }], [{ id: '2', quantity: 7 }]]);
    fireEvent.click(within(two).getByRole('button', { name: '上移 Thresholds 2' }));
    save(true);
    await screen.findByText('已儲存並載入完整基準');
    expect(output('composition-saved').tiers[0].thresholds).toMatchObject([
      { _brume: { key: 'h2' }, gifts: [{ id: '2', quantity: 7 }] },
      { _brume: { key: 'h1' }, gifts: [{ id: '1', quantity: 5 }] },
    ]);
  });
  it('preserves row-owned type, selections and scalars through reorder/remove/add and saves inactive owners accurately', async () => {
    renderWithBrume(<FormCompositionPage />);
    let rows = thresholds();
    const one = first(rows);
    const two = rows[1];
    if (!two) throw new Error('Missing row');
    rowType(one, '優惠券');
    fireEvent.change(within(one).getByLabelText(/^優惠券代碼/), {
      target: { value: '  H1-NEW  ' },
    });
    rowType(two, '點數');
    fireEvent.change(within(two).getByLabelText(/^贈送點數/), { target: { value: '222' } });
    rowType(two, '商品');
    rowType(two, '點數');
    fireEvent.click(within(two).getByRole('button', { name: '上移 Thresholds 2' }));
    rows = thresholds();
    expect(first(rows).dataset.repeaterKey).toBe('h2');
    expect(within(first(rows)).getByLabelText(/^贈送點數/)).toHaveProperty('value', '222');
    const shifted = rows[1];
    if (!shifted) throw new Error('Missing shifted row');
    expect(within(shifted).getByLabelText(/^優惠券代碼/)).toHaveProperty('value', '  H1-NEW  ');
    save(true);
    await screen.findByText('已儲存並載入完整基準');
    let saved = output('composition-saved').tiers[0].thresholds;
    expect(saved[0]).toMatchObject({
      _brume: { key: 'h2' },
      points: 222,
      coupon_code: 'STORED-H2',
      gifts: [{ id: '2', quantity: 3 }],
    });
    expect(saved[1]).toMatchObject({
      _brume: { key: 'h1' },
      coupon_code: 'H1-NEW',
      points: 100,
      gifts: [{ id: '1', quantity: 2 }],
    });
    fireEvent.click(within(first(thresholds())).getByRole('button', { name: '移除 Thresholds 1' }));
    fireEvent.click(screen.getByRole('button', { name: '新增 Thresholds' }));
    rows = thresholds();
    const added = rows[1];
    if (!added) throw new Error('Missing added row');
    expect(added.dataset.repeaterKey).not.toBe('h2');
    expect(within(added).getByRole('radio', { name: '商品' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    rowType(added, '點數');
    expect(within(added).getByLabelText(/^贈送點數/)).toHaveProperty('value', '');
    fireEvent.change(within(added).getByLabelText(/^贈送點數/), { target: { value: '333' } });
    save(true);
    await waitFor(() =>
      expect(output('composition-saved').tiers[0].thresholds[1]?.points).toBe(333),
    );
    saved = output('composition-saved').tiers[0].thresholds;
    expect(saved[0]).toMatchObject({
      _brume: { key: 'h1' },
      coupon_code: 'H1-NEW',
      gifts: [{ id: '1', quantity: 2 }],
    });
    expect(saved[1]).toMatchObject({ points: 333, coupon_code: null, gifts: [] });
    expect(JSON.stringify(saved)).not.toContain('h2');
  });
});

it.each(['edit', 'owner'] as const)(
  'does not adopt a late canonical response after a newer %s',
  async (changeKind) => {
    const initial = giftValues();
    const memory = createGiftMemory(giftForm, initial);
    let release: (() => void) | undefined;
    let requested = false;
    const result = renderWithBrume(<GiftForm form={giftForm} initial={initial} />, {
      respond: async (request) => {
        if (request.url === '/gift/stored') {
          requested = true;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return (await memory.respond(request)) ?? { status: 404, data: {} };
      },
    });
    type('優惠券');
    change('優惠券代碼', '  ACCEPTED  ');
    save();
    await waitFor(() => expect(requested).toBe(true));
    if (changeKind === 'edit') change('優惠券代碼', 'newer edit');
    else
      result.rerender(
        <GiftForm
          key="replacement"
          form={giftForm}
          initial={{ ...initial, gift_type: 'coupon', coupon_code: 'new owner' }}
        />,
      );
    await act(async () => {
      release?.();
    });
    expect(screen.queryByText('已儲存並載入完整基準')).toBeNull();
    if (changeKind === 'edit')
      expect(screen.getByLabelText(/^優惠券代碼/)).toHaveProperty('value', 'newer edit');
    else expect(screen.getByLabelText(/^優惠券代碼/)).toHaveProperty('value', 'new owner');
    if (changeKind === 'edit') {
      fireEvent.click(screen.getByRole('button', { name: '重設贈品草稿' }));
      expect(screen.getByLabelText(/^優惠券代碼/)).toHaveProperty('value', 'ACCEPTED');
    }
  },
);

it.each(['coupon', 'points'] as const)(
  'keeps Reset locked through canonical GET for %s and then resets to the accepted complete snapshot',
  async (branch) => {
    const initial = giftValues();
    const memory = createGiftMemory(giftForm, initial);
    let release: (() => void) | undefined;
    let requested = false;
    renderWithBrume(<GiftForm form={giftForm} initial={initial} />, {
      respond: async (request) => {
        if (request.url === '/gift/stored') {
          requested = true;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return (await memory.respond(request)) ?? { status: 404, data: {} };
      },
    });
    type('優惠券');
    change('優惠券代碼', '  ACCEPTED  ');
    if (branch === 'points') {
      type('點數');
      change('贈送點數', '444');
    }
    save();
    const reset = screen.getByRole('button', { name: '重設贈品草稿' });
    expect(reset).toHaveProperty('disabled', true);
    await waitFor(() => expect(requested).toBe(true));
    expect(reset).toHaveProperty('disabled', true);
    expect(screen.getByText('已儲存，正在載入完整基準…')).toBeTruthy();
    fireEvent.click(reset);
    await act(async () => {
      release?.();
    });
    await screen.findByText('已儲存並載入完整基準');
    expect(reset).toHaveProperty('disabled', false);
    expect(output('gift-draft')).toEqual(memory.store.saved);
    const code = branch === 'coupon' ? 'ACCEPTED' : initial.coupon_code;
    expect(output('gift-draft')).toMatchObject({
      coupon_code: code,
      points: branch === 'points' ? 444 : 100,
    });
    type('優惠券');
    change('優惠券代碼', 'after-save draft');
    fireEvent.click(reset);
    expect(output('gift-draft')).toEqual(memory.store.saved);
    expect(output('gift-draft').coupon_code).toBe(code);
  },
);

it.each(['status', 'network'] as const)(
  'keeps Reset on its last confirmed baseline when canonical GET fails with %s',
  async (failure) => {
    const initial = giftValues();
    const memory = createGiftMemory(giftForm, initial);
    let failCanonical = false;
    renderWithBrume(<GiftForm form={giftForm} initial={initial} />, {
      respond: async (request) => {
        if (request.url === '/gift/stored' && failCanonical) {
          if (failure === 'network') throw new Error('canonical connection failed');
          return { status: 503, data: {} };
        }
        return (await memory.respond(request)) ?? { status: 404, data: {} };
      },
    });
    type('點數');
    change('贈送點數', '125');
    save();
    await screen.findByText('已儲存並載入完整基準');
    const confirmed = structuredClone(memory.store.saved);
    failCanonical = true;
    type('優惠券');
    change('優惠券代碼', 'hidden unsaved coupon');
    type('點數');
    change('贈送點數', '444');
    save();
    await screen.findByText('已儲存，但無法載入完整基準；重設將回到上次確認資料。');
    expect(screen.queryByText('已儲存並載入完整基準')).toBeNull();
    const reset = screen.getByRole('button', { name: '重設贈品草稿' });
    expect(reset).toHaveProperty('disabled', false);
    fireEvent.click(reset);
    expect(output('gift-draft')).toEqual(confirmed);
    expect(output('gift-draft').points).toBe(125);
    expect(output('gift-draft').coupon_code).toBe('STORED-ROOT');
  },
);
