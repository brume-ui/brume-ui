import { expect, openPage, test } from './support';

// Non-pixel guard: the font swap must be detectable even if screenshots drift.
test('fonts page: jf and Noto columns differ and jf-openhuninn loads for Chinese text', async ({
  page,
}) => {
  await openPage(page, 'fonts', 'light');
  const family = (id: string) =>
    page.getByTestId(`pg-font-${id}`).evaluate((el) => getComputedStyle(el).fontFamily);
  const jf = await family('jf');
  const noto = await family('noto');
  expect(jf).toContain('jf-openhuninn');
  expect(noto).not.toContain('jf-openhuninn');
  expect(jf).not.toBe(noto);
  await page.evaluate(() => document.fonts.load('16px "jf-openhuninn"', '中'));
  expect(await page.evaluate(() => document.fonts.check('16px "jf-openhuninn"', '中'))).toBe(true);
});
