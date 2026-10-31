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
