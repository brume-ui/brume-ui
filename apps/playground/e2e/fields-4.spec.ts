import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { animationsIdle, expect, SCHEMES, type Scheme, storeScheme, test } from './support';

/*
 * Real-browser tests of the small input fields (ip, rate, slider, range, icon, time, timeRange,
 * captcha) and the button layout node through the focused demos #/form-fields?example=form.field.*
 * and #/form-layouts?example=form.layout.button. Values are read from the form itself (the demo's
 * 「目前草稿」/「實際請求值」 evidence), not only from the DOM.
 */

const FIELD = (type: string) => `/#/form-fields?example=form.field.${type}`;
const BUTTON = '/#/form-layouts?example=form.layout.button';

async function open(page: Page, url: string, testId: string, scheme?: Scheme) {
  if (scheme) await storeScheme(page, scheme);
  await page.goto(url);
  await expect(page.getByTestId(testId)).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
const openField = (page: Page, type: string, scheme?: Scheme) =>
  open(page, FIELD(type), 'pg-form-fields', scheme);

async function draft(page: Page): Promise<Record<string, unknown>> {
  return JSON.parse((await page.getByTestId('form-draft').textContent()) ?? '{}');
}
async function wire(page: Page): Promise<Record<string, unknown>> {
  return JSON.parse((await page.getByTestId('form-wire').textContent()) ?? '{}');
}
async function saved(page: Page): Promise<Record<string, unknown>> {
  return JSON.parse((await page.getByTestId('form-saved').textContent()) ?? '{}');
}
const save = (page: Page) =>
  page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();
const fieldError = (page: Page, message: string) =>
  page.getByRole('alert').filter({ hasText: message });
const requests = (page: Page) => page.getByTestId('request-count');

test.describe('ip field', () => {
  const box = (page: Page, name = '伺服器位址') => page.getByRole('textbox', { name, exact: true });
  for (const good of ['192.168.1.10', '::1', '2001:db8::8a2e:370:7334', '::ffff:192.0.2.1']) {
    test(`accepts ${good}`, async ({ page }) => {
      await openField(page, 'ip');
      await box(page).fill(`  ${good}  `);
      await save(page);
      await expect.poll(async () => (await wire(page)).value).toBe(good);
      await expect(fieldError(page, '請輸入有效的 IP 位址')).toHaveCount(0);
    });
  }
  for (const bad of [
    '256.1.1.1',
    '01.2.3.4',
    '1.2.3',
    '1::2::3',
    'fe80::1%eth0',
    '[::1]',
    '1.2.3.4/24',
  ]) {
    test(`rejects ${bad} and sends nothing`, async ({ page }) => {
      await openField(page, 'ip');
      await box(page).fill(bad);
      await save(page);
      await expect(fieldError(page, '請輸入有效的 IP 位址')).toBeVisible();
      await expect(requests(page)).toContainText('儲存請求：0');
    });
  }
  test('the version restrictions swap the accepted family; blank is null', async ({ page }) => {
    await openField(page, 'ip');
    await box(page, '僅 IPv4').fill('::1');
    await box(page, '僅 IPv6').fill('1.2.3.4');
    await save(page);
    await expect(fieldError(page, '請輸入有效的 IPv4 位址')).toBeVisible();
    await expect(fieldError(page, '請輸入有效的 IPv6 位址')).toBeVisible();
    await box(page, '僅 IPv4').fill('10.0.0.1');
    await box(page, '僅 IPv6').fill('   ');
    await save(page);
    await expect.poll(async () => (await wire(page)).v4).toBe('10.0.0.1');
    expect((await wire(page)).v6).toBeNull();
  });
});

test.describe('rate field', () => {
  test('shows a % suffix, stores a decimal string and rejects out-of-range and non-numeric text', async ({
    page,
  }) => {
    await openField(page, 'rate');
    const box = page.getByRole('textbox', { name: '折扣率 %' });
    await box.fill('12.5');
    await save(page);
    await expect.poll(async () => (await wire(page)).value).toBe('12.5');
    await box.fill('101');
    await save(page);
    await expect(fieldError(page, '不可大於 100。')).toBeVisible();
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await box.fill('abc');
    await save(page);
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await expect(requests(page)).toContainText('儲存請求：1');
    expect((await wire(page)).value).toBe('12.5');
  });
});

test.describe('slider', () => {
  const slider = (page: Page, name: string) => page.getByRole('slider', { name, exact: true });

  test('arrows, Home and End change the value and the announced text', async ({ page }) => {
    await openField(page, 'slider');
    const volume = slider(page, '音量');
    await volume.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await draft(page)).value).toBe(35);
    await expect(volume).toHaveValue('35');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await draft(page)).value).toBe(25);
    await page.keyboard.press('End');
    await expect.poll(async () => (await draft(page)).value).toBe(100);
    await page.keyboard.press('Home');
    await expect.poll(async () => (await draft(page)).value).toBe(0);
    await page.keyboard.press('ArrowLeft');
    expect((await draft(page)).value).toBe(0);
    await expect(volume).toHaveAttribute('aria-valuetext', '0');
  });

  test('a fractional step (0.1) lands on 0.4 without floating-point noise', async ({ page }) => {
    await openField(page, 'slider');
    await slider(page, '比例').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await draft(page)).ratio).toBe(0.4);
    await save(page);
    await expect.poll(async () => (await wire(page)).ratio).toBe(0.4);
  });

  test('an untouched form with a required empty slider is clean and submits its minimum', async ({
    page,
  }) => {
    await openField(page, 'slider');
    await expect(slider(page, '必填等級')).toHaveValue('10');
    await expect(page.getByTestId('form-dirty')).toHaveText('無未儲存變更');
    expect((await draft(page)).level).toBe(10);
    await save(page);
    await expect.poll(async () => (await wire(page)).level).toBe(10);
    expect(await wire(page)).toEqual({ value: 30, ratio: 0.3, level: 10 });
    await expect(page.getByTestId('form-dirty')).toHaveText('無未儲存變更');
  });

  test('leaving an untouched form with a required empty slider raises no prompt', async ({
    page,
  }) => {
    await openField(page, 'slider');
    await expect(page.getByTestId('form-dirty')).toHaveText('無未儲存變更');
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.dismiss();
    });
    // A real in-app navigation: the router moves on and nothing asks to confirm.
    await page.evaluate(() => {
      window.location.hash = '/button';
    });
    await expect(page.getByTestId('pg-button')).toBeVisible();
    await expect(page.getByTestId('pg-form-fields')).toHaveCount(0);
    expect(dialogs).toEqual([]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('moving the required slider is a change', async ({ page }) => {
    await openField(page, 'slider');
    await slider(page, '必填等級').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('form-dirty')).toHaveText('有未儲存變更');
    expect((await draft(page)).level).toBe(20);
  });
});

test.describe('range and time fields', () => {
  test('range: reversed bounds put the error on the end box; equal bounds and one bound save', async ({
    page,
  }) => {
    await openField(page, 'range');
    const start = page.getByRole('textbox', { name: '重量範圍（起）' });
    const end = page.getByRole('textbox', { name: '重量範圍（迄）' });
    await start.fill('5.0');
    await end.fill('4.0');
    await save(page);
    await expect(fieldError(page, '結束值不可小於起始值')).toBeVisible();
    await expect(end).toHaveAttribute('aria-invalid', 'true');
    await expect(requests(page)).toContainText('儲存請求：0');
    await end.fill('5.0');
    await save(page);
    await expect.poll(async () => (await wire(page)).value).toEqual({ start: '5.0', end: '5.0' });
    await end.fill('');
    await save(page);
    await expect.poll(async () => ((await wire(page)).value as { end: unknown }).end).toBeFalsy();
  });

  test('time: 09:05 saves, the seconds field keeps its seconds, a cleared box stores null', async ({
    page,
  }) => {
    await openField(page, 'time');
    const plain = page.getByRole('textbox', { name: '營業開始' });
    await plain.fill('09:15');
    await save(page);
    await expect.poll(async () => (await wire(page)).value).toBe('09:15');
    expect((await wire(page)).precise).toBe('09:05:30');
    await plain.fill('');
    await save(page);
    await expect.poll(async () => (await wire(page)).value).toBeNull();
  });

  test('timeRange: an overnight range saves unchanged', async ({ page }) => {
    await openField(page, 'timeRange');
    await expect(page.getByRole('textbox', { name: '營業時段（起）' })).toHaveValue('22:00');
    await expect(page.getByRole('textbox', { name: '營業時段（迄）' })).toHaveValue('06:00');
    await save(page);
    await expect
      .poll(async () => (await wire(page)).value)
      .toEqual({ start: '22:00', end: '06:00' });
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('captcha', () => {
  const image = (page: Page) => page.getByRole('img', { name: '驗證圖片' });
  const answer = (page: Page) => page.getByRole('textbox', { name: '驗證碼', exact: true });
  const srcOf = async (page: Page) => (await image(page).getAttribute('src')) ?? '';

  test('the refresh button changes the image URL (query string cache busting)', async ({
    page,
  }) => {
    await openField(page, 'captcha');
    await expect(image(page)).toBeVisible();
    await expect
      .poll(() =>
        image(page).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
      )
      .toBe(true);
    const first = await srcOf(page);
    expect(first).toMatch(/^\/demo\/captcha\.svg/);
    const refresh = page.getByRole('button', { name: '重新取得驗證圖片' });
    await refresh.click();
    const second = await srcOf(page);
    expect(second).not.toBe(first);
    expect(second).toMatch(/captcha\.svg\?r=\d+/);
    await refresh.click();
    await expect.poll(() => srcOf(page)).not.toBe(second);
    // The refreshed URL still loads (the static file ignores the query).
    await expect
      .poll(() =>
        image(page).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
      )
      .toBe(true);
  });

  test('a failed submit refreshes the image and clears the answer; the right answer saves without it', async ({
    page,
  }) => {
    await openField(page, 'captcha');
    const before = await srcOf(page);
    await answer(page).fill('WRONG');
    await save(page);
    await expect(fieldError(page, '驗證碼不正確。')).toBeVisible();
    await expect(requests(page)).toContainText('儲存請求：1');
    expect((await wire(page)).code).toBe('WRONG');
    await expect.poll(() => srcOf(page)).not.toBe(before);
    await expect(answer(page)).toHaveValue('');
    expect((await draft(page)).code).toBeNull();
    // The other field's draft survives the failed submit.
    expect((await draft(page)).name).toBe('示範訪客');
    const afterFail = await srcOf(page);
    await answer(page).fill('A7K9');
    await save(page);
    await expect.poll(async () => (await wire(page)).code).toBe('A7K9');
    await expect.poll(async () => (await saved(page)).name).toBe('示範訪客');
    expect(await saved(page)).not.toHaveProperty('code');
    // A successful save resets the form, which refreshes the image again.
    await expect.poll(() => srcOf(page)).not.toBe(afterFail);
    await expect(answer(page)).toHaveValue('');
  });

  test('a required captcha left empty blocks the submit', async ({ page }) => {
    await openField(page, 'captcha');
    await save(page);
    await expect(requests(page)).toContainText('儲存請求：0');
    await expect(answer(page)).toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('button layout node', () => {
  test('renders links with the right href and target', async ({ page }) => {
    await open(page, BUTTON, 'pg-form-layouts');
    const inApp = page.getByRole('link', { name: '前往站內說明' });
    await expect(inApp).toHaveAttribute('href', '/admin/help');
    await expect(inApp).not.toHaveAttribute('target');
    const external = page.getByRole('link', { name: /開啟外部公告/ });
    await expect(external).toHaveAttribute('href', 'https://example.com/policy');
    await expect(external).toHaveAttribute('target', '_blank');
    await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    // A button has no value: nothing is added to the draft.
    expect(Object.keys(await draft(page))).toEqual(['name', 'address']);
  });
});

/** The icon picker, in a form dialog (modal) and on the page. */
const iconTrigger = (scope: Page | Locator) =>
  scope.getByRole('button', { name: '選單圖示：選擇圖示' });
const picker = (page: Page) => page.getByRole('dialog', { name: '選單圖示' });
const iconBox = (scope: Page | Locator) =>
  scope.getByRole('textbox', { name: '選單圖示', exact: true });
const grid = (page: Page) => page.getByRole('group', { name: '圖示清單' });
const scrollTop = (loc: Locator) => loc.evaluate((el) => el.scrollTop);

test.describe('icon field', () => {
  test('page: keyboard search, arrow to a result and Enter picks it; focus returns to the trigger', async ({
    page,
  }) => {
    await openField(page, 'icon');
    await iconTrigger(page).focus();
    await page.keyboard.press('Enter');
    const pop = picker(page);
    await expect(pop).toBeVisible();
    const search = pop.getByRole('searchbox', { name: '搜尋圖示' });
    await expect(search).toBeFocused();
    await search.fill('user');
    await page.keyboard.press('ArrowDown');
    const focused = page.locator(':focus');
    const name = (await focused.getAttribute('aria-label')) ?? '';
    expect(name).toContain('user');
    await page.keyboard.press('Enter');
    await expect(pop).toBeHidden();
    await expect(iconTrigger(page)).toBeFocused();
    await expect(iconBox(page)).toHaveValue(name);
    await save(page);
    await expect.poll(async () => (await wire(page)).value).toBe(name);
  });

  test('page: Escape closes the picker, focus returns to the trigger and the value is unchanged', async ({
    page,
  }) => {
    await openField(page, 'icon');
    await iconTrigger(page).click();
    await expect(picker(page)).toBeVisible();
    await picker(page).getByRole('searchbox', { name: '搜尋圖示' }).fill('user');
    await page.keyboard.press('Escape');
    await expect(picker(page)).toBeHidden();
    await expect(iconTrigger(page)).toBeFocused();
    await expect(iconBox(page)).toHaveValue('settings');
    expect((await draft(page)).value).toBe('settings');
  });

  test('page: the unfiltered list is capped and the wheel scrolls the grid', async ({ page }) => {
    await openField(page, 'icon');
    await iconTrigger(page).click();
    await expect(picker(page)).toBeVisible();
    await expect(grid(page).getByRole('button')).toHaveCount(120);
    await expect(picker(page).getByText('僅顯示前 120 個圖示')).toBeVisible();
    const g = grid(page);
    const pageBefore = await page.evaluate(() => window.scrollY);
    await g.hover();
    await page.mouse.wheel(0, 300);
    await expect.poll(() => scrollTop(g)).toBeGreaterThan(0);
    // The wheel moved the grid, not the page behind the popover.
    expect(await page.evaluate(() => window.scrollY)).toBe(pageBefore);
  });

  test('a stored name lucide no longer has still shows the fallback glyph and saves', async ({
    page,
  }) => {
    await openField(page, 'icon');
    await iconBox(page).fill('icon-that-lucide-removed');
    await save(page);
    await expect.poll(async () => (await wire(page)).value).toBe('icon-that-lucide-removed');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await iconBox(page).fill('Not Kebab');
    await save(page);
    await expect(fieldError(page, '請輸入有效的圖示名稱')).toBeVisible();
  });

  test.describe('inside a modal dialog', () => {
    async function openDialog(page: Page) {
      await openField(page, 'icon');
      await page.getByRole('button', { name: '在彈窗中編輯', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '在彈窗中編輯' });
      await expect(dialog).toBeVisible();
      return dialog;
    }

    test('opens in the dialog, searches, picks by keyboard and focus returns to the trigger', async ({
      page,
    }) => {
      const dialog = await openDialog(page);
      const trigger = iconTrigger(dialog);
      await trigger.focus();
      await page.keyboard.press('Enter');
      const pop = picker(page);
      await expect(pop).toBeVisible();
      const search = pop.getByRole('searchbox', { name: '搜尋圖示' });
      await expect(search).toBeFocused();
      await search.fill('arrow-up');
      await expect(grid(page).getByRole('button').first()).toBeVisible();
      await page.keyboard.press('ArrowDown');
      const name = (await page.locator(':focus').getAttribute('aria-label')) ?? '';
      expect(name).toContain('arrow-up');
      await page.keyboard.press('End');
      await page.keyboard.press('Home');
      await page.keyboard.press('Enter');
      await expect(pop).toBeHidden();
      await expect(dialog).toBeVisible();
      await expect(trigger).toBeFocused();
      await expect(iconBox(dialog)).toHaveValue(name);
      await dialog.getByRole('button', { name: '儲存', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect.poll(async () => (await wire(page)).value).toBe(name);
    });

    test('Escape closes only the picker and returns focus to the trigger', async ({ page }) => {
      const dialog = await openDialog(page);
      await iconTrigger(dialog).click();
      await expect(picker(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(picker(page)).toBeHidden();
      await expect(dialog).toBeVisible();
      await expect(iconTrigger(dialog)).toBeFocused();
    });

    test('the mouse wheel scrolls the icon grid inside the dialog', async ({ page }) => {
      const dialog = await openDialog(page);
      await iconTrigger(dialog).click();
      await expect(picker(page)).toBeVisible();
      const g = grid(page);
      await expect(g.getByRole('button')).toHaveCount(120);
      expect(await scrollTop(g)).toBe(0);
      await g.hover();
      await page.mouse.wheel(0, 300);
      await expect.poll(() => scrollTop(g)).toBeGreaterThan(0);
      // Wait for the smooth/async scroll to settle before reading the position.
      let afterOne = -1;
      await expect
        .poll(async () => {
          const now = await scrollTop(g);
          const settled = now === afterOne;
          afterOne = now;
          return settled;
        })
        .toBe(true);
      // And back up again: the wheel works in both directions inside the dialog.
      await page.mouse.wheel(0, -150);
      await expect.poll(() => scrollTop(g)).toBeLessThan(afterOne);
      // The dialog itself stays put and open.
      await expect(dialog).toBeVisible();
    });
  });
});

test.describe('axe', () => {
  for (const type of ['ip', 'rate', 'slider', 'range', 'icon', 'time', 'timeRange', 'captcha']) {
    test(`${type} demo has no axe violations`, async ({ page }) => {
      await openField(page, type);
      await animationsIdle(page);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(
        violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
      ).toEqual([]);
    });
  }
  test('button layout demo has no axe violations', async ({ page }) => {
    await open(page, BUTTON, 'pg-form-layouts');
    await animationsIdle(page);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))).toEqual(
      [],
    );
  });
  test('icon demo with the picker open has no axe violations', async ({ page }) => {
    await openField(page, 'icon');
    await iconTrigger(page).click();
    await expect(picker(page)).toBeVisible();
    await animationsIdle(page);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))).toEqual(
      [],
    );
  });
});

// Linux baselines are generated in CI (update-snapshots workflow); do not commit darwin ones.
for (const scheme of SCHEMES) {
  for (const width of [1440, 390]) {
    test.describe(`fields-4 screenshots ${scheme} ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });
      for (const type of ['slider', 'range', 'captcha', 'ip', 'rate', 'time', 'timeRange']) {
        test(`${type} demo (${scheme}, ${width})`, async ({ page }) => {
          await openField(page, type, scheme);
          await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          await animationsIdle(page);
          await expect(page.locator('form').first()).toHaveScreenshot(
            `small-${type}-${scheme}-${width}.png`,
          );
        });
      }
      test(`icon field closed and picker open (${scheme}, ${width})`, async ({ page }) => {
        await openField(page, 'icon', scheme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        await animationsIdle(page);
        await expect(page.locator('form').first()).toHaveScreenshot(
          `small-icon-${scheme}-${width}.png`,
        );
        await iconTrigger(page).click();
        await expect(picker(page)).toBeVisible();
        await animationsIdle(page);
        await expect(picker(page)).toHaveScreenshot(`small-icon-picker-${scheme}-${width}.png`);
      });
      test(`button node (${scheme}, ${width})`, async ({ page }) => {
        await open(page, BUTTON, 'pg-form-layouts', scheme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        const link = page.getByRole('link', { name: '前往站內說明' });
        await link.scrollIntoViewIfNeeded();
        await animationsIdle(page);
        await expect(page.locator('form').first()).toHaveScreenshot(
          `small-button-${scheme}-${width}.png`,
        );
      });
    });
  }
}
