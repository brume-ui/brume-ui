import { expect, openPage, test } from './support';

test.describe('charts', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('hovering a bar category shows every series and dims the rest', async ({ page }) => {
    await openPage(page, 'dashboard', 'light');
    const plot = page.locator('[data-chart="bar"]');
    await plot.scrollIntoViewIfNeeded();
    const box = await plot.boundingBox();
    if (!box) throw new Error('no plot');
    // Third of six categories (3C 周邊).
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.7);
    const tip = plot.locator('[data-chart-tooltip]');
    await expect(tip).toContainText('3C 周邊');
    await expect(tip).toContainText('$612,000');
    await expect(tip).toContainText('$188,000');
    await expect(plot.locator('[data-bar-group="0"]')).toHaveCSS('opacity', '0.6');
    await page.mouse.move(5, 5);
    await expect(tip).toHaveCount(0);
  });

  test('keyboard reaches a chart and steps through its values', async ({ page }) => {
    await openPage(page, 'dashboard', 'light');
    const plot = page.getByRole('group', { name: /每日營收：/ });
    await plot.focus();
    const tip = plot.locator('[data-chart-tooltip]');
    await expect(tip).toContainText('10/1');
    await page.keyboard.press('ArrowRight');
    await expect(tip).toContainText('10/2');
    await expect(plot.locator('[data-active-point]')).toHaveCount(2);
    await page.keyboard.press('End');
    await expect(tip).toContainText('10/28');
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
  });

  test('the legend hides a series and keeps the last one', async ({ page }) => {
    await openPage(page, 'dashboard', 'light');
    const figure = page.getByRole('figure', { name: '分類營收' });
    const online = figure.getByRole('button', { name: '線上' });
    const store = figure.getByRole('button', { name: '門市' });
    await online.click();
    await expect(online).toHaveAttribute('aria-pressed', 'false');
    await expect(figure.locator('path[data-series="online"]')).toHaveCount(0);
    // The last visible series is locked: clicking it changes nothing.
    await expect(store).toHaveAttribute('aria-disabled', 'true');
    await store.click({ force: true });
    await expect(store).toHaveAttribute('aria-pressed', 'true');
    await expect(figure.locator('path[data-series="store"]')).toHaveCount(6);
  });

  test('each chart has a data table twin for screen readers', async ({ page }) => {
    await openPage(page, 'dashboard', 'light');
    const table = page.getByRole('table', { name: '訂單狀態資料表' });
    await expect(table.getByRole('row')).toHaveCount(6);
    await expect(table.getByRole('row').nth(1)).toHaveText('已完成1,86469.4%');
  });

  test('charts animate in, and not at all under reduced motion', async ({ page }) => {
    await page.goto('/#/dashboard');
    await expect(page.locator('[data-bar-group]').first()).toHaveCSS(
      'animation-name',
      'br-chart-grow-y',
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.locator('[data-bar-group]').first()).toBeVisible();
    await expect(page.locator('[data-bar-group]').first()).toHaveCSS('animation-name', 'none');
    await expect(page.locator('[data-chart="line"] path[pathLength]').first()).toHaveCSS(
      'animation-name',
      'none',
    );
  });

  test('charts fill a phone-width card without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, 'charts', 'light');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});

test.describe('charts on touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('tapping shows the tapped datum, not the first one', async ({ page }) => {
    await openPage(page, 'dashboard', 'light');
    const bars = page.locator('[data-chart="bar"]');
    await bars.scrollIntoViewIfNeeded();
    const box = await bars.boundingBox();
    if (!box) throw new Error('no plot');
    // Last of six categories (運動).
    await page.touchscreen.tap(box.x + box.width * 0.94, box.y + box.height * 0.75);
    const tip = bars.locator('[data-chart-tooltip]');
    await expect(tip).toContainText('運動');
    await expect(bars.locator('xpath=ancestor::figure').locator('[aria-live]')).toHaveText('');

    const slice = page.locator('[data-chart="donut"] path[data-series="已出貨"]');
    await slice.scrollIntoViewIfNeeded();
    const point = await slice.evaluate((el: SVGPathElement) => {
      const p = el.getPointAtLength(el.getTotalLength() / 2);
      const m = el.getScreenCTM();
      if (!m) throw new Error('no CTM');
      return { x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f };
    });
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator('[data-chart="donut"] [data-chart-tooltip]')).toContainText('已出貨');
  });
});
