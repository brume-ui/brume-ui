import AxeBuilder from '@axe-core/playwright';
import { FORM_EXAMPLES } from '../src/pages/form-feature-data';
import { animationsIdle, expect, SCHEMES, storeScheme, test } from './support';

// CI only. No live trial service is a permitted target for these scenarios.
for (const scheme of SCHEMES) {
  for (const width of [1440, 390]) {
    test.describe(`focused forms ${scheme} ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });
      test('tabs reveal the invalid nested field, support keyboard navigation and pass axe', async ({
        page,
      }) => {
        await storeScheme(page, scheme);
        await page.goto('/#/form-layouts?example=form.layout.sections-tabs');
        await expect(page.getByTestId('pg-form-layouts')).toBeVisible();
        await page.getByRole('tab', { name: '基本分段' }).focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('tab', { name: '地址分段' })).toBeFocused();
        await page.keyboard.press('Enter');
        await page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();
        await expect(page.getByRole('textbox', { name: '城市', exact: true })).toBeFocused();
        await expect(page.getByRole('tab', { name: /地址分段.*有錯誤/ })).toBeVisible();
        await page.getByRole('textbox', { name: '城市', exact: true }).fill('臺北');
        await page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();
        await expect(page.getByTestId('form-saved')).toContainText('臺北');
        await animationsIdle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      });
      test('rule errors and server422 retry preserve keyboard focus and real values', async ({
        page,
      }) => {
        await storeScheme(page, scheme);
        await page.goto('/#/form-behaviors?example=form.rule.integer');
        await page.getByLabel('整數文字', { exact: true }).fill('1.5');
        await page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();
        await expect(page.getByLabel('整數文字', { exact: true })).toBeFocused();
        await page.getByLabel('整數文字', { exact: true }).fill('2');
        await page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();
        await expect(page.getByTestId('form-saved')).toContainText('"integer": "2"');
        await page.goto('/#/form-behaviors?example=form.behavior.submit-after-edit');
        await page.getByLabel('名稱', { exact: true }).fill('  新名稱  ');
        await page.getByLabel('模擬回應').selectOption('server422');
        await page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();
        await expect(page.getByLabel('名稱', { exact: true })).toBeFocused();
        await page.getByLabel('模擬回應').selectOption('success');
        await page.getByLabel('名稱', { exact: true }).fill('  可用名稱  ');
        await page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();
        await expect(page.getByLabel('名稱', { exact: true })).toHaveValue('可用名稱');
        await expect(page.getByTestId('form-dirty')).toHaveText('無未儲存變更');
        await animationsIdle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      });
      test('multipart upload has progress, cancellation, errors, retry and accessible controls', async ({
        page,
      }) => {
        await storeScheme(page, scheme);
        await page.goto('/#/form-fields?example=form.field.upload');
        const input = page.locator('input[type=file]');
        await page.getByLabel(/慢速請求/).check();
        await input.setInputFiles({
          name: 'cancel.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('cancel'),
        });
        await expect(page.getByRole('progressbar')).toBeVisible();
        await page.getByRole('button', { name: '移除 cancel.txt' }).click();
        await expect(page.getByTestId('request-count')).toContainText('取消：1');
        await page.getByLabel(/慢速請求/).uncheck();
        await page.getByLabel('模擬上傳失敗').check();
        await input.setInputFiles({
          name: 'retry.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('retry'),
        });
        await expect(page.getByText(/模擬上傳失敗，請移除後重選/)).toBeVisible();
        await page.getByRole('button', { name: '移除 retry.txt' }).click();
        await page.getByLabel('模擬上傳失敗').uncheck();
        await input.setInputFiles({
          name: 'retry.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('retry'),
        });
        await expect(page.getByRole('progressbar')).toHaveCount(0);
        await page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();
        await expect(page.getByTestId('form-saved')).toContainText('focused-');
        await animationsIdle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      });
    });
  }
}

test('every focused feature has a working direct target, guide and form without overflow', async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const feature of FORM_EXAMPLES) {
    await page.goto(`/#/${feature.route}?example=${feature.id}`);
    await expect(page.getByTestId(`pg-${feature.route}`)).toBeVisible();
    await expect(page.getByRole('complementary', { name: '示範操作說明' })).toContainText(
      feature.title,
    );
    await expect(page.getByTestId('form-draft')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByText('找不到功能說明')).toHaveCount(0);
  }
});

test('selected owners keep bounded hydration and nested requests cannot cross row lifetimes', async ({
  page,
}) => {
  await page.goto('/#/form-behaviors?example=relation.picker-large-selection');
  await expect(page.getByText('商品 101', { exact: true })).toBeVisible();
  await expect(page.getByTestId('options-pending')).toHaveText('選項請求中：0');
  await expect(page.getByTestId('request-count')).toContainText('100, 1');
  await expect(page.getByTestId('form-effective')).toContainText('權威 101');
  await page.goto('/#/form-behaviors?example=relation.picker-nested-lifetime');
  await page.getByLabel(/慢速請求/).check();
  const rows = page.getByRole('list', { name: '外層列', exact: true });
  await rows.getByRole('button', { name: /巢狀商品/ }).click();
  await rows.getByRole('button', { name: '移除 外層列 1', exact: true }).click();
  await page.getByRole('button', { name: /新增.*外層列/ }).click();
  await expect(page.getByTestId('options-pending')).toHaveText('選項請求中：0');
  await expect(rows.getByText('商品 2', { exact: true })).toHaveCount(0);
});

test('network failure preserves keyboard focus, draft and duplicate-submit protection', async ({
  page,
}) => {
  await page.goto('/#/form-behaviors?example=form.behavior.submit-network');
  await page.getByLabel('名稱', { exact: true }).fill('重試草稿');
  await page.getByLabel(/慢速請求/).check();
  await page.getByLabel('模擬回應').selectOption('network');
  const save = page.getByRole('button', { name: '儲存後繼續編輯', exact: true });
  await save.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(save).toBeDisabled();
  await expect(page.getByTestId('request-count')).toContainText('儲存請求：1');
  await expect(save).toBeEnabled();
  await expect(save).toBeFocused();
  await expect(page.getByLabel('名稱', { exact: true })).toHaveValue('重試草稿');
  await page.getByLabel(/慢速請求/).uncheck();
  await page.getByLabel('模擬回應').selectOption('success');
  await save.click();
  await expect(page.getByTestId('form-saved')).toContainText('重試草稿');
});

// Authored for isolated CI only; --list is the sole permitted local E2E command.
for (const scheme of SCHEMES) {
  for (const width of [1440, 390]) {
    test.describe(`focused grids ${scheme} ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });
      test('textarea cancel, server422 and retry preserve confirmed display', async ({ page }) => {
        await storeScheme(page, scheme);
        await page.goto('/#/grid-features?example=grid.editor.textarea');
        const row = page.locator('tbody tr').filter({ hasText: 'ORD-2610024' });
        await row.getByRole('button', { name: /^編輯備註/ }).click();
        await row.getByRole('textbox', { name: '備註', exact: true }).fill('取消的備註');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('grid-records')).not.toContainText('取消的備註');
        await row.getByRole('button', { name: /^編輯備註/ }).click();
        await row.getByRole('textbox', { name: '備註', exact: true }).fill('長'.repeat(201));
        await page.keyboard.press('ControlOrMeta+Enter');
        await expect(row.getByRole('alert')).toHaveText('備註最多 200 個字。');
        await row.getByRole('button', { name: /^編輯備註/ }).click();
        await row.getByRole('textbox', { name: '備註', exact: true }).fill('修正後的備註');
        await page.keyboard.press('ControlOrMeta+Enter');
        await expect(page.getByTestId('grid-records')).toContainText('修正後的備註');
        await expect(page.getByTestId('grid-events')).toContainText('422');
        await expect(row.getByRole('alert')).toHaveCount(0);
        await animationsIdle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      });
      test('range filter changes actual rows and chip clearing restores all rows', async ({
        page,
      }) => {
        await storeScheme(page, scheme);
        await page.goto('/#/grid-features?example=grid.input.range-text');
        await page.getByRole('button', { name: '篩選', exact: true }).click();
        await page
          .getByRole('textbox', { name: '聚焦篩選（起）', exact: true })
          .fill('ORD-2610010');
        await page
          .getByRole('textbox', { name: '聚焦篩選（迄）', exact: true })
          .fill('ORD-2610015');
        await page.getByRole('button', { name: '套用篩選', exact: true }).click();
        await expect(page.getByTestId('grid-result-count')).toContainText('符合 6 筆');
        await expect(page.locator('tbody tr')).toHaveCount(6);
        await page.getByRole('button', { name: '移除篩選：聚焦篩選', exact: true }).click();
        await expect(page.getByTestId('grid-result-count')).toContainText('符合 24 筆');
        await animationsIdle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      });
    });
  }
}

test('focused action input can cancel, show422 and retry; mixed batches report actual results', async ({
  page,
}) => {
  await page.goto('/#/grid-features?example=grid.behavior.action-input');
  const row = page.locator('tbody tr').filter({ hasText: 'ORD-2610024' });
  await row.getByRole('button', { name: '註記原因', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '註記訂單', exact: true });
  await dialog.getByRole('textbox', { name: '原因', exact: true }).fill('取消草稿');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByTestId('grid-records')).not.toContainText('取消草稿');
  await row.getByRole('button', { name: '註記原因', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: '原因', exact: true })).toHaveValue('');
  await dialog.getByRole('textbox', { name: '原因', exact: true }).fill('短');
  await dialog.getByRole('button', { name: '套用註記', exact: true }).click();
  await expect(dialog.getByText('原因至少 3 個字。')).toBeVisible();
  await dialog.getByRole('textbox', { name: '原因', exact: true }).fill('客服已確認');
  await dialog.getByRole('button', { name: '套用註記', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('grid-records')).toContainText('客服已確認');
  await page.goto('/#/grid-features?example=grid.behavior.batch-errors');
  await page.getByRole('checkbox', { name: '選取 ORD-2610024', exact: true }).check();
  await page.getByRole('checkbox', { name: '選取 ORD-2610023', exact: true }).check();
  await page
    .getByRole('region', { name: '批次操作', exact: true })
    .getByRole('button', { name: '標記為已出貨', exact: true })
    .click();
  await expect(page.getByRole('status').filter({ hasText: '1 筆尚未付款所以略過' })).toBeVisible();
  await page.getByRole('button', { name: '送出範圍外 ID（403）', exact: true }).click();
  await expect(page.getByTestId('grid-events')).toContainText('403');
});

test('native Grid export controls produce all, page and selected downloadable CSV fixtures', async ({
  page,
}) => {
  const { readFile } = await import('node:fs/promises');
  await page.goto('/#/grid-features?example=grid.behavior.export-memory');
  await page.getByRole('checkbox', { name: '選取 ORD-2610024', exact: true }).check();
  for (const [label, count] of [
    ['符合條件的全部資料', 24],
    ['目前這一頁', 10],
    ['已選取的 1 筆', 1],
  ] as const) {
    await page.getByRole('button', { name: '匯出 Excel', exact: true }).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: label, exact: true }).click();
    const download = await downloading;
    const path = await download.path();
    expect(path).toBeTruthy();
    const text = await readFile(path as string, 'utf8');
    expect(text.trim().split(/\r?\n/)).toHaveLength(count + 1);
    expect(text).toContain('ORD-2610024');
    expect(download.suggestedFilename()).toMatch(/orders-(all|page|selected)\.csv/);
  }
  await expect(page.getByTestId('grid-events')).toContainText('export_scope=selected');
});

test('resource page navigation saves through the existing form server and returns to Grid', async ({
  page,
}) => {
  await page.goto('/#/grid-features?example=grid.behavior.resource-page');
  await page
    .locator('tbody tr')
    .filter({ hasText: 'ORD-2610024' })
    .getByRole('button', { name: 'ORD-2610024', exact: true })
    .click();
  await expect(page.getByRole('button', { name: '返回聚焦列表', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '客戶', exact: true }).fill('獨立頁修改');
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await page.getByRole('button', { name: '返回聚焦列表', exact: true }).click();
  await expect(page.locator('tbody tr').filter({ hasText: 'ORD-2610024' })).toContainText(
    '獨立頁修改',
  );
});

test('all Grid focused targets render their guide and real grid or explicit backend contract', async ({
  page,
}) => {
  const { GRID_EXAMPLES } = await import('../src/pages/grid-feature-data');
  test.setTimeout(120_000);
  for (const example of GRID_EXAMPLES) {
    await page.goto(`/#/grid-features?example=${example.id}`);
    await expect(page.getByRole('complementary', { name: '示範操作說明' })).toContainText(
      example.title,
    );
    await expect(
      page.getByTestId(example.backend ? 'grid-backend-path' : 'focused-grid'),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
