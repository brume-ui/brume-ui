import AxeBuilder from '@axe-core/playwright';
import { CLOSURE_EXAMPLES } from '../src/pages/coverage-closure-data';
import { animationsIdle, expect, SCHEMES, storeScheme, test } from './support';

// Authored for ordinary isolated remote CI. Do not execute against live trial4180.
for (const scheme of SCHEMES) {
  for (const width of [1440, 390]) {
    test.describe(`public contracts ${scheme} ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });
      test('all focused public targets have observable content, accessible controls and no horizontal overflow', async ({
        page,
      }) => {
        test.setTimeout(120_000);
        await storeScheme(page, scheme);
        for (const example of CLOSURE_EXAMPLES.filter(
          (item) => !item.id.startsWith('lifecycle.'),
        )) {
          await page.goto(`/#/public-contracts?example=${example.id}`);
          await expect(page.getByTestId('pg-public-contracts')).toBeVisible();
          await expect(page.getByRole('combobox', { name: '聚焦功能' })).toHaveValue(example.id);
          await animationsIdle(page);
          expect((await new AxeBuilder({ page }).analyze()).violations, example.id).toEqual([]);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            example.id,
          ).toBe(true);
        }
      });
      test('progress, page-local details, nested providers and keyboard field layout operate', async ({
        page,
      }) => {
        await storeScheme(page, scheme);
        await page.goto('/#/public-contracts?example=react.ProgressBar');
        const slider = page.getByRole('slider', { name: '進度值' });
        await slider.focus();
        await page.keyboard.press('End');
        await expect(page.getByRole('progressbar', { name: '完成進度' })).toHaveAttribute(
          'aria-valuenow',
          '80',
        );
        await page.goto('/#/public-contracts?example=react.LinkButton');
        await page.getByRole('button', { name: '開啟明細' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('region', { name: '頁內明細' })).toBeVisible();
        await page.goto('/#/public-contracts?example=react.BrumeProvider');
        await page.getByRole('button', { name: '內層請求' }).click();
        await expect(page.getByLabel('內層記錄')).toContainText('/內層');
        await expect(page.getByLabel('外層記錄')).toHaveText('[]');
        await page.goto('/#/public-contracts?example=react.FieldLayoutContext');
        await page.getByRole('combobox', { name: '欄位版型' }).selectOption('horizontal');
        await expect(page.locator('[data-field-layout]')).toHaveAttribute(
          'data-field-layout',
          'horizontal',
        );
        await page.getByRole('textbox', { name: '地點' }).fill('新竹');
        await expect(page.getByRole('textbox', { name: '地點' })).toHaveValue('新竹');
        await animationsIdle(page);
        await expect(page.getByTestId('pg-public-contracts')).toHaveScreenshot(
          `public-field-context-${scheme}-${width}.png`,
        );
      });
      test('query/schema failures and lifecycle evidence remain truthful', async ({ page }) => {
        await storeScheme(page, scheme);
        await page.goto('/#/public-contracts?example=contract.query');
        await page.getByRole('button', { name: '載入非法值案例' }).click();
        await expect(page.getByLabel('解析結果')).toContainText('"filtersCleared": true');
        await page.goto('/#/public-contracts?example=contract.schema');
        await page.getByRole('button', { name: '載入未知頁型' }).click();
        await expect(page.getByLabel('Schema 驗證結果')).toContainText('"ok": false');
        await page.goto('/#/public-contracts?example=lifecycle.upload-rollback');
        await expect(page.getByRole('status')).toContainText('此頁不執行資料庫');
        await expect(
          page.getByText(
            'nested rollback removes only new finals and permits retry with unchanged temporary content',
            { exact: true },
          ),
        ).toBeVisible();
        await expect(
          page.getByRole('link', {
            name: /brume-laravel:tests\/Feature\/Form\/NestedUploadTest.php/,
          }),
        ).toHaveAttribute('href', /blob\/b44fb4c/);
        await animationsIdle(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      });
    });
  }
}
