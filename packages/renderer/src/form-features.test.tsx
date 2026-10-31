import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import type { FormDef } from '@brume-ui/brume-schema';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FIELD_EXAMPLES,
  FORM_EXAMPLES,
  UPLOAD_PRESETS,
} from '../../../apps/playground/src/pages/form-feature-data';
import { FocusedFormDemo } from '../../../apps/playground/src/pages/form-feature-demo';
import * as focusedMemory from '../../../apps/playground/src/pages/form-feature-memory';
import {
  createFocusedAdapter,
  type Store,
} from '../../../apps/playground/src/pages/form-feature-memory';
import { renderWithBrume } from './test-utils';

const first = <T,>(values: T[]): T => {
  const value = values[0];
  if (!value) throw new Error('Missing expected control');
  return value;
};
const change = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
const save = (name = '儲存後繼續編輯') => fireEvent.click(screen.getByRole('button', { name }));
const output = (name: string) => JSON.parse(screen.getByTestId(name).textContent || '{}');

describe('focused public Form examples', () => {
  it.each(FIELD_EXAMPLES)(
    'serializes the public $field.type field through a real save request',
    async ({ field, value }) => {
      renderWithBrume(<FocusedFormDemo exampleId={`form.field.${field.type}`} />);
      save();
      await waitFor(() => expect(output('form-saved')[field.name]).toEqual(value));
      expect(output('form-wire')[field.name]).toEqual(value);
      if (field.type === 'display') expect(screen.getByText(String(value))).toBeTruthy();
      if (field.type === 'hidden') expect(screen.queryByLabelText(field.label)).toBeNull();
    },
  );
  it.each(UPLOAD_PRESETS)(
    'uploads and submits focused $id as its declared single/multiple shape',
    async ({ id, field }) => {
      renderWithBrume(<FocusedFormDemo exampleId={id} />);
      const mime = field.accept[0] ?? 'application/pdf';
      fireEvent.change(screen.getByLabelText('附件', { selector: 'input' }), {
        target: {
          files: [new File(['a'], field.kind === 'image' ? 'a.png' : 'a.pdf', { type: mime })],
        },
      });
      await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
      save();
      await waitFor(() => expect(output('form-saved')).toHaveProperty('files'));
      const value = output('form-saved').files;
      expect(Array.isArray(value)).toBe(field.multiple);
      expect(field.multiple ? value[0].token : value.token).toMatch(/^focused-/);
    },
  );
  it('has all public field/layout examples and every requested gap', () => {
    expect(FORM_EXAMPLES.length).toBeGreaterThan(60);
    expect(new Set(FORM_EXAMPLES.map((x) => x.id)).size).toBe(FORM_EXAMPLES.length);
    expect(FORM_EXAMPLES.find((x) => x.id === 'form.field.currency')).toBeTruthy();
    expect(FORM_EXAMPLES.find((x) => x.id === 'relation.picker-large-selection')).toBeTruthy();
  });
  it('submits exact currency, literal hidden and nonempty display without claiming editable projection', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.field.currency" />);
    change('金額', '123.45');
    save();
    await waitFor(() => expect(output('form-wire').amount).toBe('123.45'));
    await waitFor(() => expect(output('form-saved').amount).toBe('123.45'));
  });
  it('exposes integer/numeric/maxLength errors through typeable public text inputs and permits repair', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.rule.integer" />);
    change('整數文字', '1.5');
    change('數值文字', 'abc');
    change('短文字', 'abcdef');
    save();
    expect(screen.getAllByText('請輸入整數。').length).toBeGreaterThan(0);
    expect(screen.getAllByText('請輸入數值。').length).toBeGreaterThan(0);
    expect(screen.getAllByText('最多五個字。').length).toBeGreaterThan(0);
    expect(output('form-wire')).toEqual({});
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '儲存後繼續編輯' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    change('整數文字', '2');
    change('數值文字', '2.5');
    change('短文字', 'abc');
    save();
    await waitFor(() => expect(output('form-saved').integer).toBe('2'));
  });
  it('navigates tabs to errors and serializes embeds', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.layout.sections-tabs" />);
    save();
    await waitFor(() => expect(screen.getByLabelText(/^城市/)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/^城市/), { target: { value: '臺北' } });
    save();
    await waitFor(() => expect(output('form-saved').address).toEqual({ city: '臺北' }));
  });
  it('preserves a cancelled draft then retries server422 and adopts the complete canonical baseline', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.submit-cancel" />);
    change('名稱', '  新名稱  ');
    fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'cancel' } });
    save();
    await screen.findByText('已取消；草稿仍在。');
    expect((screen.getByLabelText('名稱') as HTMLInputElement).value).toBe('  新名稱  ');
    expect(output('form-saved')).toEqual({});
    fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'server422' } });
    save();
    await screen.findAllByText('此名稱已被使用。');
    fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'success' } });
    change('名稱', '  可用名稱  ');
    save();
    await waitFor(() =>
      expect((screen.getByLabelText('名稱') as HTMLInputElement).value).toBe('可用名稱'),
    );
    expect(screen.getByTestId('form-dirty').textContent).toBe('無未儲存變更');
  });
  it.each(['list', 'create', 'view'] as const)(
    'renders the real memory %s target after saving',
    async (after) => {
      renderWithBrume(<FocusedFormDemo exampleId={`form.behavior.submit-after-${after}`} />);
      change('名稱', '測試記錄');
      save({ list: '儲存後返回列表', create: '儲存後新增', view: '儲存後檢視' }[after]);
      await screen.findByTestId(`memory-${after}`);
      if (after === 'create') {
        expect(screen.getByLabelText('名稱') as HTMLInputElement).toHaveProperty('value', '');
        change('名稱', '新建記錄');
        save('儲存後返回列表');
        await screen.findByTestId('memory-list');
        expect(screen.getByRole('cell', { name: '43' })).toBeTruthy();
      } else expect(screen.getByText('測試記錄')).toBeTruthy();
    },
  );
  it('keeps disabled/readonly and literal hidden in the wire while showing immutable controls', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.readonly-disabled" />);
    expect(screen.queryByLabelText('隱藏值')).toBeNull();
    expect(screen.getByText('權威唯讀')).toBeTruthy();
    expect(screen.getByLabelText('停用文字')).toHaveProperty('disabled', true);
    change('名稱', '更新');
    save();
    await waitFor(() => expect(output('form-saved').hidden).toBe('hidden-token-42'));
    expect(output('form-wire')).toMatchObject({
      readonly: '權威唯讀',
      disabled: '權威停用',
      hidden: 'hidden-token-42',
      display: '2026-11-01',
    });
  });
  it('uses new-owner fallback only on simulated save, never overwrites existing or new editable drafts', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.default-value" />);
    fireEvent.click(screen.getByRole('button', { name: /新增.*預設值列/ }));
    expect(screen.getAllByLabelText('列備註')[1]).toHaveProperty('value', '');
    expect(output('form-draft').rows[1]).not.toHaveProperty('note');
    fireEvent.click(screen.getByRole('switch', { name: '編輯列備註' }));
    expect(output('form-default-effective')[1].note).toBe('新 owner fallback');
    expect(output('form-draft').rows[1]).not.toHaveProperty('note');

    save();
    await waitFor(() => expect(output('form-saved').rows[1].note).toBe('新 owner fallback'));
    expect(output('form-saved').rows[0].note).toBe('既有草稿');
  });
  it('keeps enableWhen visible, evaluates row scope independently and treats invalid control conservatively', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.conditions-row" />);
    expect(screen.getByLabelText('依啟用開關編輯')).toHaveProperty('disabled', true);
    expect(screen.getAllByLabelText('列內優惠券備註')).toHaveLength(1);
    expect(screen.getByLabelText('列內優惠券備註')).toHaveProperty('value', '甲列草稿');
    fireEvent.click(screen.getByRole('switch', { name: '啟用' }));
    expect(screen.getByLabelText('依啟用開關編輯')).toHaveProperty('disabled', false);
    expect(
      screen.getAllByLabelText('根層啟用備註').every((x) => !(x as HTMLInputElement).disabled),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '載入無效控制值' }));
    save();
    expect(screen.getAllByText('類型不合法。').length).toBeGreaterThan(0);
    expect(screen.getAllByText('優惠券必填。').length).toBeGreaterThan(0);
    expect(output('form-wire')).toEqual({});
  });
  it('exercises ne/in/all/any/not and empty string/null/array using visible controls', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.condition.all" />);
    expect(screen.queryByLabelText('eq 條件欄位')).toBeNull();
    expect(screen.getByLabelText('ne 條件欄位')).toBeTruthy();
    expect(screen.getByLabelText('not 條件欄位')).toBeTruthy();
    for (const label of ['empty 條件欄位', 'null empty 條件欄位', 'array empty 條件欄位'])
      expect(screen.getByLabelText(label)).toBeTruthy();
    change('空值控制', 'filled');
    expect(screen.queryByLabelText('empty 條件欄位')).toBeNull();
    fireEvent.click(screen.getByRole('combobox', { name: '類型' }));
    fireEvent.click(screen.getByRole('option', { name: '優惠券' }));
    expect(screen.getByLabelText('eq 條件欄位')).toBeTruthy();
    expect(screen.getByLabelText('in 條件欄位')).toBeTruthy();
    expect(screen.getByLabelText('any 條件欄位')).toBeTruthy();
    expect(screen.queryByLabelText('all 條件欄位')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: '啟用' }));
    expect(screen.getByLabelText('all 條件欄位')).toBeTruthy();
    expect(screen.queryByLabelText('ne 條件欄位')).toBeNull();
    expect(screen.queryByLabelText('not 條件欄位')).toBeNull();
  });
  it('keeps custom address error paths distinct and excludes displayOnly from accepted editable data', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.custom-display-only" />);
    fireEvent.click(screen.getByRole('button', { name: '載入地址錯誤' }));
    const counties = screen.getAllByLabelText('County / city');
    expect(
      counties.some((x) => (x as HTMLInputElement).disabled || x.closest('fieldset')?.disabled),
    ).toBe(true);
    expect(screen.getAllByText('請修正根層縣市。')).toHaveLength(1);
    expect(screen.getAllByText('請修正列內縣市。')).toHaveLength(1);
    fireEvent.change(first(counties), { target: { value: '臺中' } });
    const row = screen.getByRole('list', { name: '地址列' });
    fireEvent.change(within(row).getByLabelText('County / city'), { target: { value: '臺南' } });
    expect(screen.queryByText('請修正根層縣市。')).toBeNull();
    expect(screen.queryByText('請修正列內縣市。')).toBeNull();
    save();
    await waitFor(() => expect(output('form-saved').address.county).toBe('臺中'));
    expect(output('form-wire')).toHaveProperty('display');
    expect(output('form-saved')).not.toHaveProperty('display');
  });
  it('locks duplicate submits during a slow network failure and retries without losing focus or draft', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.submit-network" />);
    fireEvent.click(screen.getByLabelText(/慢速請求/));
    fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'network' } });
    change('名稱', '重試草稿');
    const button = screen.getByRole('button', { name: '儲存後繼續編輯' });
    button.focus();
    save();
    save();
    expect(button).toHaveProperty('disabled', true);
    expect(screen.getByTestId('request-count').textContent).toContain('儲存請求：1');
    await waitFor(() => expect(button).toHaveProperty('disabled', false), { timeout: 2000 });
    expect(document.activeElement).toBe(button);
    expect(screen.getByLabelText('名稱')).toHaveProperty('value', '重試草稿');
    fireEvent.click(screen.getByLabelText(/慢速請求/));
    fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'success' } });
    save();
    await waitFor(() => expect(output('form-saved').name).toBe('重試草稿'));
  });
  it('executes real mocked upload errors, cancellation, MIME/size/count rejection and successful retry', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.field.upload" />);
    const file = screen.getByLabelText('附件', { selector: 'input' });
    const add = (files: File[]) => fireEvent.change(file, { target: { files } });
    add([new File(['x'], 'wrong.png', { type: 'image/png' })]);
    expect(screen.getByText(/允許|格式|類型/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /移除 wrong.png/ }));
    add([new File(['x'.repeat(1025)], 'large.txt', { type: 'text/plain' })]);
    expect(screen.getByText(/大小|超過/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /移除 large.txt/ }));
    fireEvent.click(screen.getByLabelText('模擬上傳失敗'));
    add([new File(['x'], 'retry.txt', { type: 'text/plain' })]);
    await screen.findByText(/模擬上傳失敗，請移除後重選/);
    fireEvent.click(screen.getByRole('button', { name: /移除 retry.txt/ }));
    fireEvent.click(screen.getByLabelText('模擬上傳失敗'));
    fireEvent.click(screen.getByLabelText(/慢速請求/));
    add([new File(['x'], 'cancel.txt', { type: 'text/plain' })]);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /移除 cancel.txt/ }));
    expect(screen.getByTestId('request-count').textContent).toContain('取消：1');
    fireEvent.click(screen.getByLabelText(/慢速請求/));
    add([
      new File(['a'], 'a.txt', { type: 'text/plain' }),
      new File(['b'], 'b.txt', { type: 'text/plain' }),
      new File(['c'], 'c.txt', { type: 'text/plain' }),
    ]);
    await waitFor(() => expect(output('form-draft').files).toHaveLength(2));
    expect(screen.getByText(/最多.*2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /移除 c.txt/ }));
    save();
    await waitFor(() => expect(output('form-saved').files).toHaveLength(2));
  });

  it('uses real single null/item versus multiple item[] picker drafts and hydrates readonly authority', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="relation.picker-single-multiple" />);
    expect(output('form-draft').single).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /單選商品/ }));
    fireEvent.click(await screen.findByRole('radio', { name: '選取 商品 2' }));
    fireEvent.click(screen.getByRole('button', { name: '套用' }));
    expect(output('form-draft').single).toEqual({ id: '2' });
    fireEvent.click(screen.getByRole('button', { name: /多選商品/ }));
    await waitFor(() => expect(output('form-effective').firstReadOnly).toBe(true));
    expect(screen.getByText('既有商品草稿')).toBeTruthy();
    expect(screen.queryByLabelText('商品備註', { selector: 'input' })).toBeNull();
    expect(output('form-effective').lastLocked).toBe('權威 1');
    expect(output('form-draft').selection[0].note).toBe('既有商品草稿');
    fireEvent.click(await screen.findByRole('checkbox', { name: '選取 商品 2' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '套用' })).toHaveProperty('disabled', false),
    );
    const note = screen.getByLabelText('商品備註', { selector: 'input' });
    expect(note).toHaveProperty('value', '');
    fireEvent.change(note, { target: { value: '新商品草稿' } });
    fireEvent.click(screen.getByRole('button', { name: '套用' }));
    expect(output('form-draft').selection).toHaveLength(2);
    expect(output('form-draft').selection[1]).toMatchObject({ id: '2', note: '新商品草稿' });
  });
  it('hydrates all 101 labels in bounded batches and retains the last selected owner authority', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="relation.picker-large-selection" />);
    await screen.findByText('商品 101');
    expect(screen.getByTestId('request-count').textContent).toMatch(/hydrate 批次：100, 1$/);
    fireEvent.click(screen.getByRole('button', { name: '載入101項已選商品' }));
    await screen.findByText('商品 101');
    expect(screen.queryByText(/無法使用.*101/)).toBeNull();
    expect(screen.getByTestId('request-count').textContent).toMatch(/100, 1/);
    await waitFor(() => expect(output('form-effective').lastLocked).toBe('權威 101'));
    expect(output('form-effective').firstReadOnly).toBe(true);
    expect(output('form-draft').selection).toHaveLength(101);
  });
  it('rejects a delayed nested picker response after deleting its owning row and adding a new row', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="relation.picker-nested-lifetime" />);
    fireEvent.click(screen.getByLabelText(/慢速請求/));
    const list = screen.getByRole('list', { name: '外層列' });
    fireEvent.click(within(list).getByRole('button', { name: /巢狀商品/ }));
    fireEvent.click(within(list).getByRole('button', { name: '移除 外層列 1' }));
    fireEvent.click(screen.getByRole('button', { name: /新增.*外層列/ }));
    await waitFor(
      () => expect(screen.getByTestId('options-pending').textContent).toBe('選項請求中：0'),
      { timeout: 2000 },
    );
    expect(output('form-draft').rows).toHaveLength(1);
    expect(output('form-draft').rows[0]).not.toHaveProperty('nested');
    expect(within(screen.getByRole('list', { name: '外層列' })).queryByText('商品 2')).toBeNull();
  });
  it.each(['JSON 附件列', '關聯附件列'])(
    'owns upload drafts by stable %s row through reorder and deletion',
    async (label) => {
      renderWithBrume(<FocusedFormDemo exampleId="upload.nested-memory" />);
      const list = screen.getByRole('list', { name: label });
      const input = within(list).getByLabelText('附件', { selector: 'input' });
      fireEvent.change(input, {
        target: {
          files: [
            new File(['a'], 'a.txt', { type: 'text/plain' }),
            new File(['b'], 'b.txt', { type: 'text/plain' }),
          ],
        },
      });
      await within(list).findAllByLabelText('附件備註');
      await waitFor(() => expect(within(list).queryByRole('progressbar')).toBeNull());
      fireEvent.change(first(within(list).getAllByLabelText('附件備註')), {
        target: { value: '附件甲草稿' },
      });
      fireEvent.click(within(list).getByRole('button', { name: '下移 a.txt' }));
      const key = label === 'JSON 附件列' ? 'json' : 'related';
      expect(output('form-draft')[key][0].files[1].extra.note).toBe('附件甲草稿');
      fireEvent.click(within(list).getByRole('button', { name: `移除 ${label} 1` }));
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`新增.*${label}`) }));
      expect(output('form-draft')[key][0]).not.toHaveProperty('files');
      expect(within(screen.getByRole('list', { name: label })).queryByText('a.txt')).toBeNull();
    },
  );
  it('compares translated client-rule and server-only 422 messages on the same field', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.client-rule-message" />);
    change('必填文字', '');
    save();
    expect(screen.getAllByText('請填寫名稱。').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '儲存後繼續編輯' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    expect(output('form-wire')).toEqual({});
    change('必填文字', '已填名稱');
    fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'server422' } });
    save();
    await screen.findAllByText('此名稱已被使用。');
    expect(screen.getByLabelText('必填文字').getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'success' } });
    change('必填文字', '可用名稱');
    save();
    await waitFor(() => expect(output('form-saved').required).toBe('可用名稱'));
  });
  it('does not leak an uploaded picker-extra draft when cancelling then reopening', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="upload.nested-memory" />);
    fireEvent.click(screen.getByRole('button', { name: /多選商品/ }));
    const region = screen.getByRole('region', { name: '多選商品' });
    const input = within(region).getByLabelText('附件', { selector: 'input' });
    fireEvent.change(input, {
      target: { files: [new File(['a'], 'picker.txt', { type: 'text/plain' })] },
    });
    await waitFor(() => expect(within(region).queryByRole('progressbar')).toBeNull());
    fireEvent.change(within(region).getByLabelText('附件備註'), { target: { value: '取消草稿' } });
    fireEvent.click(within(region).getByRole('button', { name: '取消' }));
    expect(output('form-draft').selection[0].files).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /多選商品/ }));
    expect(screen.queryByText('picker.txt')).toBeNull();
  });

  it('keeps conditional drafts when switching, then adopts a full saved baseline with inactive stored values', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.enable-when" />);
    const select = async (value: string) => {
      fireEvent.click(screen.getByRole('combobox', { name: '類型' }));
      fireEvent.click(screen.getByRole('option', { name: value }));
    };
    await select('優惠券');
    fireEvent.change(screen.getByLabelText(/^優惠券必填/), {
      target: { value: '尚未儲存的優惠券' },
    });
    await select('商品');
    expect(screen.queryByLabelText(/^優惠券必填/)).toBeNull();
    await select('優惠券');
    expect(screen.getByLabelText(/^優惠券必填/)).toHaveProperty('value', '尚未儲存的優惠券');
    await select('商品');
    save();
    await waitFor(() => expect(output('form-saved').type).toBe('product'));
    expect(output('form-wire').requiredCoupon).toBe('尚未儲存的優惠券');
    expect(output('form-saved').requiredCoupon).toBe('');
    await waitFor(() => expect(output('form-draft').requiredCoupon).toBe(''));
    await select('優惠券');
    fireEvent.change(screen.getByLabelText(/^優惠券必填/), { target: { value: '已存優惠券' } });
    save();
    await waitFor(() => expect(output('form-saved').requiredCoupon).toBe('已存優惠券'));
    await select('商品');
    save();
    await waitFor(() => expect(output('form-saved').type).toBe('product'));
    expect(output('form-saved').requiredCoupon).toBe('已存優惠券');
  });
  it('does not adopt a deleted owner at a reused index when saving a new default-value row', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.default-value" />);
    fireEvent.click(screen.getByRole('button', { name: '移除 預設值列 1' }));
    fireEvent.click(screen.getByRole('button', { name: /新增.*預設值列/ }));
    fireEvent.click(screen.getByRole('switch', { name: '編輯列備註' }));
    expect(output('form-default-effective')[0].note).toBe('新 owner fallback');
    save();
    await waitFor(() => expect(output('form-saved').rows[0].note).toBe('新 owner fallback'));
  });
  it('preserves the remaining condition-row owner after the first row is removed', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.conditions-row" />);
    fireEvent.click(screen.getByRole('button', { name: '移除 條件列 1' }));
    expect(output('form-draft').rows[0].rowNote).toBe('乙列草稿');
    save();
    await waitFor(() => expect(output('form-saved').rows[0].rowNote).toBe('乙列草稿'));
  });
  it('matches complete nested key/id chains, shifted picker IDs and explicit stored nulls', async () => {
    const form: FormDef = {
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: {
            type: 'repeater',
            name: 'groups',
            label: '外層',
            mode: 'relation',
            nodes: [
              {
                type: 'field',
                field: {
                  type: 'relation',
                  name: 'picked',
                  label: '選取',
                  multiple: true,
                  remote: { url: '/demo/focused/options' },
                  fields: [
                    {
                      type: 'field',
                      field: {
                        type: 'text',
                        name: 'note',
                        label: '備註',
                        readOnly: true,
                        defaultValue: '新 owner fallback',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };
    const baseline = {
      groups: [
        { _brume: { key: 'a', id: '1' }, picked: [{ id: '7', note: '甲儲存值' }] },
        {
          _brume: { key: 'b', id: '2' },
          picked: [
            { id: '7', note: null },
            { id: '8', note: '乙八儲存值' },
          ],
        },
      ],
    };
    const shifted = {
      groups: [
        {
          _brume: { key: 'b', id: '2' },
          picked: [
            { id: '8', note: '未儲存八' },
            { id: '7', note: '未儲存七' },
          ],
        },
      ],
    };
    const saved = await acceptFixture(form, baseline, shifted);
    expect(first(saved.groups).picked).toEqual([
      { id: '8', note: '乙八儲存值' },
      { id: '7', note: null },
    ]);
    for (const owner of [
      { key: 'b', id: '3' },
      { key: 'replacement', id: '2' },
    ]) {
      const replacement = await acceptFixture(form, baseline, {
        groups: [{ _brume: owner, picked: [{ id: '7', note: '替換草稿' }] }],
      });
      expect(first(first(replacement.groups).picked).note).toBe('新 owner fallback');
    }
  });
  it('runs the direct server422 selector/error/repair retry scenario', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="form.behavior.server422" />);
    expect(screen.queryByRole('button', { name: '載入無效控制值' })).toBeNull();
    fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'server422' } });
    change('名稱', '待驗證名稱');
    save();
    await screen.findAllByText('此名稱已被使用。');
    expect(screen.getByLabelText('名稱').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('名稱'));
    fireEvent.change(screen.getByLabelText('模擬回應'), { target: { value: 'success' } });
    change('名稱', '修正名稱');
    save();
    await waitFor(() => expect(output('form-saved').name).toBe('修正名稱'));
  });
  it('gives concurrent same-name root and nested uploads distinct request tokens', async () => {
    renderWithBrume(<FocusedFormDemo exampleId="upload.nested-memory" />);
    const root = first(screen.getAllByLabelText('附件', { selector: 'input' }));
    const nested = within(screen.getByRole('list', { name: 'JSON 附件列' })).getByLabelText(
      '附件',
      { selector: 'input' },
    );
    fireEvent.change(root, {
      target: { files: [new File(['root'], 'same.txt', { type: 'text/plain' })] },
    });
    fireEvent.change(nested, {
      target: { files: [new File(['nested'], 'same.txt', { type: 'text/plain' })] },
    });
    await waitFor(() => {
      expect(output('form-draft').files).toHaveLength(1);
      expect(output('form-draft').json[0].files).toHaveLength(1);
    });
    const draft = output('form-draft');
    expect(draft.files[0].token).not.toBe(draft.json[0].files[0].token);
  });
});

async function acceptFixture(
  form: FormDef,
  baseline: Record<string, unknown>,
  values: Record<string, unknown>,
) {
  const store: { current: Store } = {
    current: {
      saved: {},
      wire: {},
      requests: 0,
      uploads: 0,
      aborted: 0,
      hydrateBatches: [],
      pendingOptions: 0,
      currentId: '42',
      nextId: 43,
      revision: 0,
      listeners: new Set(),
    },
  };
  const adapter = createFocusedAdapter(
    'form.behavior.default-value',
    { form, values: baseline },
    { current: { reply: 'success', slow: false, uploadFailure: false } },
    store,
    () => {},
  );
  const result = await adapter.request({
    method: 'put',
    url: '/demo/focused/save',
    body: { values, after: 'edit' },
  });
  expect(result.status).toBe(200);
  return store.current.saved as typeof values & {
    groups: { picked: { id: string; note: unknown }[] }[];
  };
}

it.each(['success', 'hidden', 'edit', 'owner', 'status', 'network'] as const)(
  'coordinates focused Reset with canonical GET %s and never resets to an unconfirmed submitted draft',
  async (reply) => {
    const original = focusedMemory.createFocusedAdapter;
    let release: (() => void) | undefined;
    let requested = false;
    const spy = vi.spyOn(focusedMemory, 'createFocusedAdapter').mockImplementation((...args) => {
      const base = original(...args);
      return {
        ...base,
        async request<T>(request: HttpRequest): Promise<HttpResponse<T>> {
          if (request.url === '/demo/focused/stored') {
            requested = true;
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            if (reply === 'network') throw new Error('canonical connection failed');
            if (reply === 'status') return { status: 503, data: {} as T };
          }
          return base.request<T>(request);
        },
      };
    });
    try {
      const result = renderWithBrume(
        <FocusedFormDemo
          exampleId={
            reply === 'hidden' ? 'form.behavior.enable-when' : 'form.behavior.submit-after-edit'
          }
        />,
      );
      const initial = output('form-draft');
      if (reply === 'hidden') {
        fireEvent.click(screen.getByRole('combobox', { name: '類型' }));
        fireEvent.click(screen.getByRole('option', { name: '優惠券' }));
        fireEvent.change(screen.getByLabelText(/^優惠券必填/), {
          target: { value: 'hidden unsaved coupon' },
        });
        fireEvent.click(screen.getByRole('combobox', { name: '類型' }));
        fireEvent.click(screen.getByRole('option', { name: '點數' }));
      } else change('名稱', '  CANONICAL-NAME  ');
      save();
      const reset = screen.getByRole('button', { name: '重設示範資料' });
      expect(reset).toHaveProperty('disabled', true);
      await waitFor(() => expect(requested).toBe(true));
      expect(reset).toHaveProperty('disabled', true);
      expect(screen.getByText('已儲存，正在載入完整基準…')).toBeTruthy();
      fireEvent.click(reset);
      if (reply === 'edit') change('名稱', 'newer draft');
      if (reply === 'owner')
        result.rerender(
          <FocusedFormDemo key="replacement" exampleId="form.behavior.submit-after-edit" />,
        );
      await act(async () => {
        release?.();
      });
      if (reply === 'success') {
        await screen.findByText('已儲存並載入完整基準');
        expect(screen.getByLabelText('名稱')).toHaveProperty('value', 'CANONICAL-NAME');
        change('名稱', 'later draft');
        fireEvent.click(reset);
        expect(screen.getByLabelText('名稱')).toHaveProperty('value', 'CANONICAL-NAME');
      } else if (reply === 'hidden') {
        await screen.findByText('已儲存並載入完整基準');
        expect(output('form-draft').requiredCoupon).toBe('');
        change('in 條件欄位', 'later edit');
        fireEvent.click(reset);
        expect(output('form-draft')).toEqual(output('form-saved'));
        expect(output('form-draft').requiredCoupon).toBe('');
      } else if (reply === 'edit') {
        await screen.findByText('已確認儲存基準；保留較新的草稿。');
        expect(screen.getByLabelText('名稱')).toHaveProperty('value', 'newer draft');
        fireEvent.click(reset);
        expect(screen.getByLabelText('名稱')).toHaveProperty('value', 'CANONICAL-NAME');
      } else if (reply === 'owner') {
        expect(output('form-draft')).toEqual(initial);
        expect(screen.queryByText('已儲存並載入完整基準')).toBeNull();
      } else {
        await screen.findByText('已儲存，但無法載入完整基準；重設將回到上次確認資料。');
        expect(reset).toHaveProperty('disabled', false);
        fireEvent.click(reset);
        expect(output('form-draft')).toEqual(initial);
      }
    } finally {
      spy.mockRestore();
    }
  },
);
