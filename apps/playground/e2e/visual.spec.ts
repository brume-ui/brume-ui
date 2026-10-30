import { animationsIdle, expect, openPage, PAGES, SCHEMES, SLOW_PAGES, test } from './support';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const scheme of SCHEMES) {
      for (const name of PAGES) {
        test(`${name} ${scheme}`, async ({ page }) => {
          if (SLOW_PAGES.has(name)) test.setTimeout(90_000);
          await openPage(page, name, scheme);
          await expect(page).toHaveScreenshot(`${name}-${scheme}-${viewport.name}.png`, {
            fullPage: true,
            timeout: SLOW_PAGES.has(name) ? 30_000 : undefined,
          });
        });
      }

      test(`form dialog with errors ${scheme}`, async ({ page }) => {
        await openPage(page, 'form-dialog', scheme);
        await page.getByRole('button', { name: '編輯訂單', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: '編輯訂單', exact: true });
        await dialog.getByRole('textbox', { name: '顏色', exact: true }).fill('error');
        await dialog.getByRole('button', { name: '儲存', exact: true }).click();
        await expect(dialog.getByRole('alert')).toBeVisible();
        expect(
          (await dialog.getByText('儲存後', { exact: true }).boundingBox())?.height,
        ).toBeLessThanOrEqual(24);
        await animationsIdle(page);
        await expect(page).toHaveScreenshot(`form-dialog-errors-${scheme}-${viewport.name}.png`, {
          fullPage: true,
        });
      });

      test(`form page dirty save bar ${scheme}`, async ({ page }) => {
        await openPage(page, 'form-page', scheme);
        await page.getByRole('textbox', { name: '標題', exact: true }).fill('夏季訂單');
        await expect(page.getByText('● 有未儲存的變更', { exact: true })).toBeVisible();
        expect(
          (await page.getByText('儲存後', { exact: true }).boundingBox())?.height,
        ).toBeLessThanOrEqual(24);
        await animationsIdle(page);
        await expect(page).toHaveScreenshot(`form-page-dirty-${scheme}-${viewport.name}.png`, {
          fullPage: true,
        });
      });

      test(`shell with dialog open ${scheme}`, async ({ page }) => {
        await openPage(page, 'shell', scheme);
        await page.getByRole('button', { name: '新增使用者' }).click();
        await expect(page.getByRole('dialog', { name: '新增使用者' })).toBeVisible();
        await animationsIdle(page);
        await expect(page).toHaveScreenshot(`shell-dialog-${scheme}-${viewport.name}.png`);
      });
    }
  });
}
