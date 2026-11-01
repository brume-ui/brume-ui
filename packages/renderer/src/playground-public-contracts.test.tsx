/** App-only fixtures: source runtime remains unchanged. No PHP checkout or service is needed. */
import { BrumeProvider, createMemoryAdapter } from '@brume-ui/brume-react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { App } from '../../../apps/playground/src/app';
import { CLOSURE_EXAMPLES } from '../../../apps/playground/src/pages/coverage-closure-data';
import { PublicContractsPage } from '../../../apps/playground/src/pages/public-contracts';

function show(id: string) {
  window.history.replaceState(null, '', `#/public-contracts?example=${id}`);
  return render(
    <BrumeProvider adapter={createMemoryAdapter('/')}>
      <PublicContractsPage />
    </BrumeProvider>,
  );
}
afterEach(() => window.history.replaceState(null, '', '#/'));

it('shows all four Alert tones and changes real error content', () => {
  show('react.Alert');
  expect(document.querySelectorAll('[data-tone]')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: '切換錯誤訊息' }));
  expect(screen.getByText('名稱不得留白。')).toBeTruthy();
});
it('shows an initially visible CompactTable and formatted readOnly values', () => {
  const view = show('react.CompactTable');
  expect(screen.getByRole('table', { name: '商品內嵌明細' })).toBeTruthy();
  expect(screen.getByRole('cell', { name: '1280.50' })).toBeTruthy();
  view.unmount();
  show('react.StaticValue');
  expect(screen.getByText('NT$ 1,280.50')).toBeTruthy();
  expect(screen.getByText('臺北、臺中')).toBeTruthy();
});
it('exposes a real Link destination, native modified click and ordinary adapter navigation', () => {
  show('react.Link');
  fireEvent.click(screen.getByRole('link', { name: '記錄本範例導覽' }));
  expect(screen.getByLabelText('導覽記錄').textContent).toContain('visit');
  const link = screen.getByRole('link', { name: '前往功能目錄' });
  expect(link.getAttribute('href')).toBe('#/');
  const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
  let nativeAllowed = false;
  document.addEventListener(
    'click',
    (event) => {
      nativeAllowed = !event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  fireEvent(link, modified);
  expect(nativeAllowed).toBe(true);
  expect(screen.getByLabelText('連結安全判定').textContent).toContain('"safe": false');
  const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  fireEvent(link, plain);
  expect(plain.defaultPrevented).toBe(true);
  expect(window.location.hash).toBe('#/');
});
it('uses LinkButton as an in-page button with visible expanded content', () => {
  show('react.LinkButton');
  const button = screen.getByRole('button', { name: '開啟明細' });
  expect(button.hasAttribute('href')).toBe(false);
  fireEvent.click(button);
  expect(screen.getByRole('region', { name: '頁內明細' })).toBeTruthy();
  expect(button.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(button);
  expect(screen.queryByRole('region', { name: '頁內明細' })).toBeNull();
});
it('operates ProgressBar with explicit max and clamps overflow', () => {
  show('react.ProgressBar');
  const bar = screen.getByRole('progressbar', { name: '完成進度' });
  expect(bar.getAttribute('aria-valuenow')).toBe('25');
  expect(bar.getAttribute('aria-valuemax')).toBe('80');
  fireEvent.change(screen.getByRole('slider', { name: '進度值' }), { target: { value: '100' } });
  expect(bar.getAttribute('aria-valuenow')).toBe('80');
  expect(screen.getByText('100%')).toBeTruthy();
});
it('switches the actual Field context without replacing its editable value', () => {
  show('react.FieldLayoutContext');
  fireEvent.change(screen.getByLabelText('地點'), { target: { value: '新竹' } });
  fireEvent.change(screen.getByLabelText('欄位版型'), { target: { value: 'horizontal' } });
  expect(
    screen.getByLabelText('地點').closest('[data-field-layout]')?.getAttribute('data-field-layout'),
  ).toBe('horizontal');
  expect((screen.getByLabelText('地點') as HTMLInputElement).value).toBe('新竹');
});
it('keeps nested provider requests and locales independently observable', async () => {
  show('react.BrumeProvider');
  expect(screen.getByText('內層：en / Cancel')).toBeTruthy();
  expect(screen.getByText('外層：zh-TW / 取消')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '內層請求' }));
  await waitFor(() => expect(screen.getByLabelText('內層記錄').textContent).toContain('/內層'));
  expect(screen.getByLabelText('外層記錄').textContent).toBe('[]');
  fireEvent.click(screen.getByLabelText('內層英文'));
  expect(screen.getByText('內層：zh-TW / 取消')).toBeTruthy();
});
it('runs adapter guard, reload, submit and cancellation with real call records', async () => {
  show('contract.adapter');
  fireEvent.click(screen.getByLabelText('阻擋跨頁 visit'));
  fireEvent.click(screen.getByRole('button', { name: 'visit' }));
  expect(screen.getByLabelText('adapter 呼叫記錄').textContent).toBe('[]');
  fireEvent.click(screen.getByRole('button', { name: 'reload' }));
  expect(screen.getByLabelText('adapter 呼叫記錄').textContent).toContain('reload');
  fireEvent.click(screen.getByRole('button', { name: 'submit' }));
  expect(screen.getByLabelText('adapter 呼叫記錄').textContent).toContain('submit');
  fireEvent.click(screen.getByLabelText('取消 request signal'));
  fireEvent.click(screen.getByRole('button', { name: 'request' }));
  await waitFor(() =>
    expect(screen.getByLabelText('request 回應').textContent).toContain('已取消'),
  );
  fireEvent.click(screen.getByLabelText('阻擋跨頁 visit'));
  fireEvent.click(screen.getByRole('button', { name: 'visit' }));
  expect(screen.getByLabelText('目前 URL').textContent).toBe('/next');
});
it('dispatches actual list/form/dashboard/error envelopes and visibly rejects unknown/major mismatch', () => {
  show('renderer.page-dispatch');
  expect(screen.getByText('來自 DashboardPage.blocks 的 body')).toBeTruthy();
  expect(screen.getByText('來自 ComponentRef.props 的內容')).toBeTruthy();
  const select = screen.getByLabelText('Envelope 頁型');
  for (const kind of ['list', 'form', 'error']) {
    fireEvent.change(select, { target: { value: kind } });
    expect(screen.getByLabelText('頁面 envelope').textContent).toContain(`"type": "${kind}"`);
    expect(screen.queryByText('Envelope 被拒絕')).toBeNull();
  }
  fireEvent.change(select, { target: { value: 'unknown' } });
  expect(screen.getByText('Envelope 被拒絕')).toBeTruthy();
  fireEvent.change(select, { target: { value: 'version' } });
  expect(document.querySelector('[data-tone="danger"]')?.textContent).toContain('99.0');
});
it('renders registered components and both missing-component modes plus unknown field fallback', () => {
  show('renderer.registry');
  expect(screen.getByText('已註冊元件可見')).toBeTruthy();
  expect(screen.getByText(/NoSuchField/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText('缺漏元件'));
  const before = [...document.querySelectorAll('[data-tone="danger"]')]
    .map((node) => node.textContent)
    .join(' ');
  expect(before).toContain('NoSuchComponent');
  fireEvent.change(screen.getByLabelText('Registry 模式'), { target: { value: 'vite' } });
  const after = [...document.querySelectorAll('[data-tone="danger"]')]
    .map((node) => node.textContent)
    .join(' ');
  expect(after).toContain('NoSuchComponent');
  expect(after).not.toBe(before);
});
it('operates FormView state, validation, server errors, row identities and reset', () => {
  show('renderer.form-api');
  fireEvent.click(screen.getByRole('button', { name: '驗證全部' }));
  expect(screen.getByLabelText('表單 API 狀態').textContent).toContain('請輸入名稱。');
  fireEvent.change(screen.getByRole('textbox', { name: /^名稱/ }), {
    target: { value: 'Ada' },
  });
  expect(screen.getByLabelText('表單 API 狀態').textContent).toContain('"dirty": true');
  fireEvent.click(screen.getByRole('button', { name: '套用伺服器錯誤' }));
  expect(screen.getByLabelText('表單 API 狀態').textContent).toContain('伺服器名稱錯誤。');
  fireEvent.click(screen.getByRole('button', { name: '交換明細' }));
  let state = JSON.parse(screen.getByLabelText('表單 API 狀態').textContent ?? '{}');
  expect(state.values.rows[0]._brume.key).toBe('two');
  fireEvent.click(screen.getByRole('button', { name: '移除第一列' }));
  state = JSON.parse(screen.getByLabelText('表單 API 狀態').textContent ?? '{}');
  expect(state.values.rows).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '重設 API 草稿' }));
  state = JSON.parse(screen.getByLabelText('表單 API 狀態').textContent ?? '{}');
  expect(state.dirty).toBe(false);
  expect(state.values.rows).toHaveLength(2);
  expect(state.errors).toEqual({});
});
it('loads real form envelopes, exposes X-Brume-Form requests and clears failures', async () => {
  show('renderer.grid-api');
  fireEvent.click(screen.getByRole('button', { name: '載入表單' }));
  await waitFor(() => expect(screen.getByLabelText('載入結果').textContent).not.toBe('尚未載入'));
  expect(screen.getByLabelText('載入請求').textContent).toContain('X-Brume-Form');
  fireEvent.click(screen.getByRole('button', { name: '模擬載入失敗' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('載入範例失敗'));
  fireEvent.click(screen.getByRole('button', { name: '清除載入' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByLabelText('載入結果').textContent).toBe('尚未載入');
});
it('actually parses list/range/group query parameters and excludes unsafe or invalid values', () => {
  show('contract.query');
  let parsed = JSON.parse(screen.getByLabelText('解析結果').textContent ?? '{}');
  expect(parsed).toMatchObject({
    page: 2,
    perPage: 10,
    q: '茶',
    scope: 'paid',
    sort: { key: 'amount', direction: 'desc' },
    filters: {
      status: ['paid', 'open'],
      amount: { start: '10', end: '20' },
      name: { op: 'like', value: '茶' },
    },
  });
  expect(screen.getByLabelText('保留其他參數的 URL').textContent).toContain('campaign=demo');
  fireEvent.click(screen.getByRole('button', { name: '載入非法值案例' }));
  parsed = JSON.parse(screen.getByLabelText('解析結果').textContent ?? '{}');
  expect(parsed).toEqual({ filters: {}, filtersCleared: true });
});
it('validates real schema input and exposes emitted schema evidence', () => {
  show('contract.schema');
  expect(screen.getByLabelText('Schema 驗證結果').textContent).toContain('"ok": true');
  fireEvent.click(screen.getByRole('button', { name: '載入未知頁型' }));
  expect(screen.getByLabelText('Schema 驗證結果').textContent).toContain('"ok": false');
  fireEvent.change(screen.getByLabelText('Envelope JSON'), { target: { value: '{' } });
  expect(screen.getByLabelText('Schema 驗證結果').textContent).toContain('JSON 語法錯誤');
});
it('provides protocol fixtures with actual reuse links and transparent Inertia host evidence', () => {
  const view = show('contract.protocol');
  expect(screen.getByLabelText('HTTP 契約案例').textContent).toContain('images.2.extra.link');
  expect(screen.getByRole('link', { name: '下載與匯出' }).getAttribute('href')).toContain(
    'grid.behavior.export-memory',
  );
  view.unmount();
  show('contract.inertia');
  expect(screen.getByRole('link', { name: /Workbench 同訊息 toast/ }).getAttribute('href')).toBe(
    'http://127.0.0.1:8100/admin/_demo/toast',
  );
  expect(screen.getByLabelText('Host 契約對照').textContent).toContain('brume_locale');
});
it('uses token variables across semantic colors, spacing, radii, shadows, font and focusable controls', () => {
  show('style.tokens');
  expect(document.querySelectorAll('.pg-token-swatch')).toHaveLength(10);
  expect(document.querySelectorAll('.pg-token-space')).toHaveLength(4);
  expect(document.querySelectorAll('.pg-token-box')).toHaveLength(7);
  expect(screen.getByRole('button', { name: '用 Tab 核對焦點環' })).toBeTruthy();
});
it('renders every backend lifecycle contract with exact fixture, test name, command and source without fake save controls', () => {
  const view = show('lifecycle.save-reload');
  for (const item of CLOSURE_EXAMPLES.filter((entry) => entry.id.startsWith('lifecycle.'))) {
    act(() => {
      window.history.replaceState(null, '', `#/public-contracts?example=${item.id}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByText(item.testName)).toBeTruthy();
    expect(screen.getByText(item.command)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('此頁不執行資料庫');
    expect(screen.queryByRole('button')).toBeNull();
    for (const source of item.evidence)
      expect(screen.getByRole('link', { name: source }).getAttribute('href')).toContain(
        '/blob/b44fb4c',
      );
  }
  view.unmount();
});

it('mounts the new route through App with exactly one focused instruction landmark', () => {
  window.history.replaceState(null, '', '#/public-contracts?example=contract.query');
  render(<App />);
  expect(screen.getAllByLabelText('示範操作說明')).toHaveLength(1);
  expect(screen.getByLabelText('原始 query')).toBeTruthy();
});
