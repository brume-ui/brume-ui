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
