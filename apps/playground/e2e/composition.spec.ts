import AxeBuilder from '@axe-core/playwright';
import { expect, storeScheme, test } from './support';

for (const scheme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    test(`composition JSON, hidden required values and custom field (${scheme}, ${width})`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await storeScheme(page, scheme);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/form-composition');
      await expect(page.getByRole('heading', { name: 'Composition acceptance' })).toBeVisible();
      await expect(page.getByLabel('Delivery instructions', { exact: true })).toHaveCount(0);
      await page.getByLabel('Street address', { exact: true }).fill('Round trip road');
      await page.getByRole('textbox', { name: 'JSON message', exact: true }).fill('Kept JSON');
      await page.getByRole('button', { name: 'Save composition', exact: true }).click();
      await expect(page.getByTestId('composition-saved')).toContainText('Round trip road');
      await expect(page.getByTestId('composition-saved')).toContainText('Kept JSON');
      expect(await page.evaluate(() => window.innerWidth)).toBe(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      expect(
        (await new AxeBuilder({ page }).include('[data-testid="pg-form-composition"]').analyze())
          .violations,
      ).toEqual([]);
      expect(errors).toEqual([]);
      await expect(page.getByTestId('pg-form-composition')).toHaveScreenshot(
        `composition-${scheme}-${width}.png`,
      );
    });
  }
}

test('composition dependency hydration follows latest category and hidden required fields retain their draft', async ({
  page,
}) => {
  await page.goto('/#/form-composition');
  const choice = page.getByRole('combobox', { name: 'Dependent choice', exact: true });
  await page.getByRole('combobox', { name: 'Composition category', exact: true }).click();
  await page.getByRole('option', { name: 'Category B', exact: true }).click();
  await expect(choice).toHaveValue('B product 7');
  await page.waitForTimeout(300); // Let the deliberately slower A response settle.
  await expect(choice).toHaveValue('B product 7');
  await page.getByRole('switch', { name: 'Delivery required', exact: true }).check();
  const instructions = page.getByRole('textbox', { name: 'Delivery instructions', exact: true });
  await page.getByRole('button', { name: 'Save composition', exact: true }).click();
  await expect(instructions).toHaveAttribute('aria-invalid', 'true');
  await instructions.fill('Keep the draft');
  await page.getByRole('switch', { name: 'Delivery required', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save composition', exact: true }).click();
  await expect(page.getByTestId('composition-saved')).toContainText('Keep the draft');
  await page.getByRole('switch', { name: 'Delivery required', exact: true }).check();
  await expect(instructions).toHaveValue('Keep the draft');
});

test('Grid table pickers emit scalar and ID-array filters rather than relation objects', async ({
  page,
}) => {
  await page.goto('/#/form-composition');
  await page.getByRole('button', { name: '篩選', exact: true }).click();
  await page.getByRole('button', { name: /Single product filter/ }).click();
  let dialog = page.getByRole('group', { name: 'Single product filter', exact: true });
  await dialog.getByRole('radio', { name: /A product 2$/ }).check();
  await dialog.getByRole('button', { name: '套用', exact: true }).click();
  await page.getByRole('button', { name: /Multiple product filter/ }).click();
  dialog = page.getByRole('group', { name: 'Multiple product filter', exact: true });
  await dialog.getByRole('checkbox', { name: /A product 1$/ }).check();
  await dialog.getByRole('checkbox', { name: /A product 3$/ }).check();
  await dialog.getByRole('button', { name: '套用', exact: true }).click();
  await page.getByRole('button', { name: '套用篩選', exact: true }).click();
  const target = new URL(
    (await page.getByTestId('composition-url').textContent()) ?? '',
    'http://localhost',
  );
  expect(target.searchParams.get('filter[one]')).toBe('2');
  expect(target.searchParams.getAll('filter[many][]')).toEqual(['1', '3']);
  expect(target.search).not.toContain('id%5D');
});
