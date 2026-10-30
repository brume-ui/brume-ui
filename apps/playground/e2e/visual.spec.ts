import type { Locator, Page } from '@playwright/test';
import { animationsIdle, expect, openPage, PAGES, SCHEMES, SLOW_PAGES, test } from './support';

/** Native datetime segments need a complete editing surface, not a clipped overflow fix. */
async function expectFormGeometry(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  const start = page.getByLabel('配送時段（起）', { exact: true });
  const end = page.getByLabel('配送時段（迄）', { exact: true });
  for (const bound of [start, end]) {
    const metrics = await bound.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        width: box.width,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(clientWidth);
    expect(metrics.width).toBeGreaterThanOrEqual(240);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  }
  if (clientWidth <= 390) {
    const first = await start.boundingBox();
    const last = await end.boundingBox();
    expect(first).not.toBeNull();
    expect(last).not.toBeNull();
    expect(last?.y).toBeGreaterThanOrEqual((first?.y ?? 0) + (first?.height ?? 0));
  }
}

async function expectDialogGeometry(dialog: Locator): Promise<void> {
  for (const name of ['取消', '儲存']) {
    const button = dialog.getByRole('button', { name, exact: true });
    const text = await button.locator('span').first().boundingBox();
    const box = await button.boundingBox();
    expect(text).not.toBeNull();
    expect(box).not.toBeNull();
    expect(text?.height).toBeLessThanOrEqual(24);
    expect(text?.x).toBeGreaterThanOrEqual(box?.x ?? 0);
    expect((text?.x ?? 0) + (text?.width ?? 0)).toBeLessThanOrEqual(
      (box?.x ?? 0) + (box?.width ?? 0),
    );
  }
  const color = dialog.getByRole('textbox', { name: '顏色', exact: true });
  await expect(color).toBeFocused();
  const metrics = await color.evaluate((element) => {
    const body = element.closest('[data-dialog-body]');
    const field = element.closest('[data-field-layout]');
    const error = (element.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id))
      .find((node) => node?.textContent === '這個顏色目前無法供應。');
    if (!body || !field || !error) throw new Error('Missing field error or dialog scrollport');
    const bounds = (node: Element) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    };
    return {
      body: bounds(body),
      field: bounds(field),
      control: bounds(element),
      error: bounds(error),
    };
  });
  for (const region of [metrics.field, metrics.control, metrics.error]) {
    expect(region.top).toBeGreaterThanOrEqual(metrics.body.top);
    expect(region.bottom).toBeLessThanOrEqual(metrics.body.bottom);
  }
}

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
          if (['form', 'form-horizontal', 'form-page'].includes(name))
            await expectFormGeometry(page);
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
        await expectDialogGeometry(dialog);
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
        await expectFormGeometry(page);
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
