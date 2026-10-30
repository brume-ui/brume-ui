import AxeBuilder from '@axe-core/playwright';
import { expect, storeScheme, test } from './support';

for (const scheme of ['light', 'dark'] as const) {
  test(`relation picker keyboard, one dialog and 390px layout (${scheme})`, async ({ page }) => {
    await storeScheme(page, scheme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/form-relations');
    await page.getByRole('checkbox', { name: /Delay Category A/ }).uncheck();
    await page.getByRole('button', { name: 'Open relation dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Relation dialog' });
    const trigger = dialog.getByRole('button', { name: /Related products/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const search = dialog.getByRole('textbox', { name: /Search|搜尋|搜索/ });
    await expect(search).toBeFocused();
    await search.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await dialog.getByLabel('Quantity', { exact: true }).fill('9');
    await dialog.getByRole('button', { name: /Next page|下一頁|下一页/ }).click();
    const third = dialog.getByRole('checkbox', { name: /Product 3/ });
    await third.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Space');
    await expect(dialog.getByLabel('Quantity', { exact: true })).toHaveCount(2);
    await expect(dialog.getByLabel('Quantity', { exact: true }).first()).toHaveValue('9');
    await search.focus();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(dialog).toBeVisible();
    await trigger.press('Enter');
    await expect(dialog.getByLabel('Quantity', { exact: true })).toHaveValue('2');
    await expect(dialog.getByLabel('Selection note')).toHaveValue('Original');
    await expect(dialog.getByRole('checkbox', { name: /Product/ }).first()).toBeVisible();
    const box = await dialog.boundingBox();
    if (!box) throw new Error('Dialog has no bounding box');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(results.violations).toEqual([]);
    await expect(dialog).toHaveScreenshot(`relation-picker-${scheme}-390.png`, {
      animations: 'disabled',
    });
  });
}

test('page draft commits ordered extras after pagination and section change', async ({ page }) => {
  await page.goto('/#/form-relations');
  await page.getByRole('checkbox', { name: /Delay Category A/ }).uncheck();
  await page.getByRole('button', { name: /Related products/ }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('4');
  await page.getByRole('button', { name: /Next page|下一頁|下一页/ }).click();
  await page.getByRole('checkbox', { name: /Product 3/ }).check();
  await page.getByLabel(/Section|分類|分类/).selectOption('featured');
  await page.getByRole('button', { name: /^(Apply|套用|应用)$/ }).click();
  await expect(page.getByTestId('picker-values')).toHaveText(
    '[{"id":"1","quantity":"4","note":"Original"},{"id":"3"}]',
  );
});
