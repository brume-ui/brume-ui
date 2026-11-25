import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { animationsIdle, expect, SCHEMES, type Scheme, storeScheme, test } from './support';

/*
 * Real-browser tests of the colour field, the phone field and the html layout block through the
 * focused demos #/form-fields?example=form.field.color / form.field.tel and
 * #/form-layouts?example=form.layout.html. Values are read from the form itself (the demo's
 * 「目前草稿」/「實際請求值」 evidence), not only from the DOM.
 */

const COLOR = '/#/form-fields?example=form.field.color';
const TEL = '/#/form-fields?example=form.field.tel';
const HTML = '/#/form-layouts?example=form.layout.html';

async function open(page: Page, url: string, testId: string, scheme?: Scheme) {
  if (scheme) await storeScheme(page, scheme);
  await page.goto(url);
  await expect(page.getByTestId(testId)).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
const openColor = (page: Page, scheme?: Scheme) => open(page, COLOR, 'pg-form-fields', scheme);
const openTel = (page: Page) => open(page, TEL, 'pg-form-fields');
const openHtml = (page: Page, scheme?: Scheme) => open(page, HTML, 'pg-form-layouts', scheme);

async function draft(page: Page): Promise<Record<string, unknown>> {
  return JSON.parse((await page.getByTestId('form-draft').textContent()) ?? '{}');
}
async function wire(page: Page): Promise<Record<string, unknown>> {
  return JSON.parse((await page.getByTestId('form-wire').textContent()) ?? '{}');
}
const save = (page: Page) =>
  page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();

/** A field's own error text (the guide beside the demo mentions the same messages). */
const fieldError = (page: Page, message: string) =>
  page.getByRole('alert').filter({ hasText: message });

const colorBox = (scope: Page | Locator) => scope.getByRole('textbox', { name: '品牌顏色' });
const chip = (scope: Page | Locator) => scope.getByRole('button', { name: '品牌顏色：開啟色盤' });
const panel = (page: Page) => page.getByRole('dialog', { name: '品牌顏色' });

test.describe('colour field', () => {
  test('typing #ABC and tabbing away shows and stores #aabbcc', async ({ page }) => {
    await openColor(page);
    const box = colorBox(page);
    await box.fill('#ABC');
    // Typing reports the raw text so validation can speak about it ...
    await expect.poll(async () => (await draft(page)).value).toBe('#ABC');
    await page.keyboard.press('Tab');
    // ... and leaving the box replaces it by the canonical form (alpha is on: #ABC stays opaque-free).
    await expect(box).toHaveValue('#aabbcc');
    expect((await draft(page)).value).toBe('#aabbcc');
    await box.fill('#abcd');
    await page.keyboard.press('Tab');
    await expect(box).toHaveValue('#aabbccdd');
    expect((await draft(page)).value).toBe('#aabbccdd');
    // The field without alpha: a 4 digit value is not a colour there and stays as typed.
    const noAlpha = page.getByRole('textbox', { name: '不透明顏色' });
    await noAlpha.fill('#ABC');
    await page.keyboard.press('Tab');
    await expect(noAlpha).toHaveValue('#aabbcc');
    expect((await draft(page)).plain).toBe('#aabbcc');
  });

  test('invalid text stays as typed, blocks the save with the field message; empty is null', async ({
    page,
  }) => {
    await openColor(page);
    const box = colorBox(page);
    await box.fill('#12345');
    await page.keyboard.press('Tab');
    await expect(box).toHaveValue('#12345');
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await save(page);
    await expect(fieldError(page, '顏色格式不正確')).toBeVisible();
    await expect(page.getByTestId('request-count')).toContainText('儲存請求：0');
    await box.fill('');
    await page.keyboard.press('Tab');
    await expect.poll(async () => (await draft(page)).value).toBeNull();
    await box.fill('#FF0000');
    // Leaving the box is what canonicalises (the demo's save buttons keep focus where it is).
    await page.keyboard.press('Tab');
    await expect(box).toHaveValue('#ff0000');
    await save(page);
    await expect.poll(async () => (await wire(page)).value).toBe('#ff0000');
  });

  test('the picker opens from the keyboard, a swatch is picked and Escape returns focus to the chip', async ({
    page,
  }) => {
    await openColor(page);
    await chip(page).focus();
    await page.keyboard.press('Enter');
    const pop = panel(page);
    await expect(pop).toBeVisible();
    const swatch = pop.getByRole('button', { name: '#e5484d' });
    await swatch.focus();
    await page.keyboard.press('Enter');
    await expect(swatch).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await draft(page)).value).toMatch(/^#e5484d(ff)?$/);
    await expect(colorBox(page)).toHaveValue(/^#e5484d(ff)?$/);
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    await expect(chip(page)).toBeFocused();
  });

  test('dragging in the picker changes the value; the keyboard moves the sliders', async ({
    page,
  }) => {
    await openColor(page);
    const before = (await draft(page)).value;
    await chip(page).click();
    const area = panel(page).locator('.react-colorful__saturation');
    await expect(area).toBeVisible();
    const box = await area.boundingBox();
    if (!box) throw new Error('no picker area');
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await draft(page)).value).not.toBe(before);
    expect((await draft(page)).value).toMatch(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/);
    // Alpha slider: an arrow key lowers the opacity byte.
    await panel(page).locator('.react-colorful__alpha .react-colorful__interactive').focus();
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(async () => String((await draft(page)).value))
      .toMatch(/^#[0-9a-f]{6}[0-9a-f]{2}$/);
    await expect(colorBox(page)).toHaveValue(String((await draft(page)).value));
  });

  test('the same field works inside a form dialog and focus returns to the chip', async ({
    page,
  }) => {
    await openColor(page);
    await page.getByRole('button', { name: '在彈窗中編輯', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '在彈窗中編輯' });
    await expect(dialog).toBeVisible();
    const trigger = chip(dialog);
    await trigger.click();
    const pop = panel(page);
    await expect(pop).toBeVisible();
    await pop.getByRole('button', { name: '#8e4ec6' }).click();
    await expect(colorBox(dialog)).toHaveValue(/^#8e4ec6(ff)?$/);
    await page.keyboard.press('Escape');
    // Escape closes the panel only; the dialog stays and focus is back on the chip.
    await expect(pop).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(trigger).toBeFocused();
    // Typing and tabbing still canonicalise in the dialog; saving sends the canonical value.
    await colorBox(dialog).fill('#0F0');
    await page.keyboard.press('Tab');
    await expect(colorBox(dialog)).toHaveValue('#00ff00');
    await dialog.getByRole('button', { name: '儲存', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await wire(page)).value).toBe('#00ff00');
  });
});

test.describe('phone field', () => {
  const field = (page: Page) => page.getByRole('textbox', { name: '客服電話' });
  for (const accepted of ['02-2345-6789#123', '(04)2345678', '0912-345-678', '+886 2 2345 6789']) {
    test(`tel accepts ${accepted} and stores it as typed`, async ({ page }) => {
      await openTel(page);
      await field(page).fill(accepted);
      await save(page);
      await expect.poll(async () => (await wire(page)).value).toBe(accepted);
      await expect(fieldError(page, '電話格式不正確')).toHaveCount(0);
    });
  }
  test('tel reports abc and does not send the request', async ({ page }) => {
    await openTel(page);
    await field(page).fill('abc');
    await save(page);
    await expect(fieldError(page, '電話格式不正確')).toBeVisible();
    await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('request-count')).toContainText('儲存請求：0');
    expect((await draft(page)).value).toBe('abc');
  });
});

test.describe('html layout block', () => {
  test('links are real links with rel; only whitelisted elements reach the DOM', async ({
    page,
  }) => {
    await openHtml(page);
    const block = page.locator('[data-html-layout="block"]');
    await expect(block).toBeVisible();
    const inApp = block.getByRole('link', { name: '站內說明' });
    await expect(inApp).toHaveAttribute('href', '/admin/help');
    await expect(inApp).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(inApp).not.toHaveAttribute('target');
    const external = block.getByRole('link', { name: /外部公告/ });
    await expect(external).toHaveAttribute('href', 'https://example.com/policy');
    await expect(external).toHaveAttribute('target', '_blank');
    await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    // Everything inside the typography wrapper (the block's only child) is from the whitelist.
    const tags = await block.evaluate((el) => [
      ...new Set(
        [...(el.firstElementChild?.querySelectorAll('*') ?? [])].map((n) =>
          n.tagName.toLowerCase(),
        ),
      ),
    ]);
    expect(tags.sort()).toEqual(['a', 'li', 'p', 'strong', 'ul']);
    // The block is display only: it adds nothing to the saved values.
    expect(Object.keys(await draft(page))).toEqual(['name', 'address']);
  });
});

test.describe('axe', () => {
  for (const [name, url, id] of [
    ['colour field', COLOR, 'pg-form-fields'],
    ['phone field', TEL, 'pg-form-fields'],
    ['html block', HTML, 'pg-form-layouts'],
  ] as const) {
    test(`${name} demo has no axe violations`, async ({ page }) => {
      await open(page, url, id);
      await animationsIdle(page);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(
        violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
      ).toEqual([]);
    });
  }

  test('colour field with the picker open has no axe violations', async ({ page }) => {
    await openColor(page);
    await chip(page).click();
    await expect(panel(page)).toBeVisible();
    await animationsIdle(page);
    const { violations } = await new AxeBuilder({ page }).analyze();
    // react-colorful 5.6.1 hard-codes English aria-labels on its sliders (a known limit, not a
    // violation); anything axe reports must be listed here on purpose.
    expect(violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))).toEqual(
      [],
    );
  });
});

// Linux baselines are generated in CI (update-snapshots workflow); do not commit darwin ones.
for (const scheme of SCHEMES) {
  for (const width of [1440, 390]) {
    test.describe(`fields-3 screenshots ${scheme} ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });
      test(`colour field closed and picker open (${scheme}, ${width})`, async ({ page }) => {
        await openColor(page, scheme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const form = page.locator('form').first();
        await animationsIdle(page);
        await expect(form).toHaveScreenshot(`color-field-${scheme}-${width}.png`);
        await chip(page).click();
        const pop = panel(page);
        await expect(pop).toBeVisible();
        await animationsIdle(page);
        await expect(pop).toHaveScreenshot(`color-picker-${scheme}-${width}.png`);
      });
      test(`html block (${scheme}, ${width})`, async ({ page }) => {
        await openHtml(page, scheme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        const block = page.locator('[data-html-layout="block"]');
        await block.scrollIntoViewIfNeeded();
        await animationsIdle(page);
        await expect(block).toHaveScreenshot(`html-block-${scheme}-${width}.png`);
      });
    });
  }
}
