import AxeBuilder from '@axe-core/playwright';
import { expect, storeScheme, test } from './support';

for (const scheme of ['light', 'dark'] as const) {
  test(`nested repeater keyboard ordering, focus and narrow layout (${scheme})`, async ({
    page,
  }) => {
    await storeScheme(page, scheme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/form-repeaters');
    const names = page.getByRole('textbox', { name: 'Group name', exact: true });
    await names.first().fill('Edited first');
    await page.getByRole('button', { name: /^(Reorder|排序) Groups 1$/ }).press('ArrowDown');
    await expect(names.nth(1)).toHaveValue('Edited first');
    await expect(page.locator('[data-repeater-key="a"]')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(names.first()).toHaveValue('Edited first');
    await page.getByRole('button', { name: /^(Remove|移除) Groups 1$/ }).click();
    await expect(page.locator('[data-repeater-key="b"]')).toBeFocused();
    await expect(names).toHaveValue('Second');
    await expect(page.getByRole('button', { name: /^(Remove|移除) Thresholds 1$/ })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    expect(
      (await new AxeBuilder({ page }).include('[data-testid="pg-form-repeaters"]').analyze())
        .violations,
    ).toEqual([]);
  });
}

test('pointer dragging nested rows preserves their values and cannot reorder the parent', async ({
  page,
}) => {
  await page.goto('/#/form-repeaters');
  const outer = page.locator('[data-repeater-key="a"]');
  await outer
    .getByRole('button', { name: /^(Reorder|排序) Thresholds 1$/ })
    .dragTo(outer.locator('[data-repeater-key="ab"]'));
  const values = JSON.parse((await page.getByTestId('repeater-values').textContent()) ?? '');
  expect(values.groups.map((row: { name: string }) => row.name)).toEqual(['First', 'Second']);
  expect(values.groups[0].thresholds.map((row: { amount: string }) => row.amount)).toEqual([
    '200.00',
    '100.00',
  ]);
  await page
    .getByRole('button', { name: /^(Reorder|排序) Groups 1$/ })
    .dragTo(page.locator('[data-repeater-key="b"]'));
  const moved = JSON.parse((await page.getByTestId('repeater-values').textContent()) ?? '');
  expect(moved.groups.map((row: { name: string }) => row.name)).toEqual(['Second', 'First']);
  expect(moved.groups[1].thresholds.map((row: { amount: string }) => row.amount)).toEqual([
    '200.00',
    '100.00',
  ]);
});
