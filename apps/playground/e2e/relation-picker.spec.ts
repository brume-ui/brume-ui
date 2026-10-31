import AxeBuilder from '@axe-core/playwright';
import { animationsIdle, expect, storeScheme, test } from './support';

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
    // Reopening starts a fresh options request while the previous page remains visible.
    // Disabled opacity transitions must finish after the controls become enabled before axe scans.
    const previous = dialog.getByRole('button', { name: /Previous page|上一頁|上一页/ });
    const next = dialog.getByRole('button', { name: /Next page|下一頁|下一页/ });
    await expect(previous).toBeEnabled();
    await expect(next).toBeEnabled();
    await expect(search).toBeFocused();
    // Layout changes can leave the last pointer over this input. Capture the intentional
    // focused + hovered state already represented by the baseline, without clicking/refocusing.
    await search.hover();
    await animationsIdle(page);
    await expect(search).toBeFocused();
    expect(
      await search.evaluate((input) => input.matches(':hover') && input.matches(':focus-visible')),
    ).toBe(true);
    await expect(previous).toHaveCSS('opacity', '1');
    await expect(next).toHaveCSS('opacity', '1');
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

test('remote tags, hierarchy, sibling exclusions and failed label hydration recover through retry', async ({
  page,
}) => {
  await page.goto('/#/form-relations');
  await page.getByRole('checkbox', { name: /Delay Category A/ }).uncheck();
  const parent = page.getByRole('combobox', { name: 'Remote parent category', exact: true });
  await expect(parent).toHaveValue('A seven');
  await parent.click();
  const root = page.getByRole('option', { name: 'A seven', exact: true });
  const descendant = page.getByRole('option', { name: 'A nine', exact: true });
  await expect(descendant).toBeVisible();
  expect(
    await descendant.evaluate((element) =>
      parseFloat(getComputedStyle(element).paddingInlineStart),
    ),
  ).toBeGreaterThan(
    await root.evaluate((element) => parseFloat(getComputedStyle(element).paddingInlineStart)),
  );
  await parent.press('Escape');

  const tags = page.getByRole('combobox', {
    name: 'Remote tag suggestions (free text)',
    exact: true,
  });
  const tagField = page.locator('[data-field-layout]').filter({ has: tags });
  await tags.fill('fixture-free-text');
  await tags.press('Enter');
  await expect(tagField.getByRole('button', { name: /fixture-free-text/ })).toBeVisible();
  await tags.fill('nine');
  await page.getByRole('option', { name: 'A nine', exact: true }).click();
  await tags.press('Escape');
  await expect(tagField.getByRole('button', { name: /A nine/ })).toBeVisible();

  const siblings = page.getByRole('combobox', { name: 'Exclusive row product', exact: true });
  await siblings.nth(1).click();
  await expect(page.getByRole('option', { name: 'A eight', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.getByRole('option', { name: 'A nine', exact: true }).click();
  await expect(siblings.nth(1)).toHaveValue('A nine');
  await siblings.first().click();
  await expect(page.getByRole('option', { name: 'A eight', exact: true })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(page.getByRole('option', { name: 'A nine', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await siblings.first().press('Escape');

  // A dependency change makes existing ID7 hydrate under B; failures remain visible and retryable.
  await page.getByRole('checkbox', { name: /Fail source requests/ }).check();
  await page.getByRole('combobox', { name: 'Category', exact: true }).click();
  await page.getByRole('option', { name: 'Category B', exact: true }).click();
  const parentField = page.locator('[data-field-layout]').filter({ has: parent });
  const retry = parentField.getByRole('button', { name: /Retry|重試|重试/ });
  await expect(retry).toBeVisible();
  await page.getByRole('checkbox', { name: /Fail source requests/ }).uncheck();
  await retry.click();
  await expect(parent).toHaveValue('B seven');
  await expect(retry).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset draft', exact: true }).click();
  await expect(parent).toHaveValue('A seven');
  await expect(tagField.getByRole('button', { name: /fixture-free-text/ })).toHaveCount(0);
});
