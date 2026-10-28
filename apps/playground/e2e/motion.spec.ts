import type { Locator, Page } from '@playwright/test';
import { expect, openPage, test } from './support';

/** Offset of `indicator` from `target` once both have settled (x, y, width, height deltas). */
async function misalignment(target: Locator, indicator: Locator): Promise<number[]> {
  const [a, b] = [await target.boundingBox(), await indicator.boundingBox()];
  if (!a || !b) throw new Error('missing box');
  return [a.x - b.x, a.y - b.y, a.width - b.width, a.height - b.height].map((n) =>
    Math.round(Math.abs(n)),
  );
}

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(600);
}

test.describe('motion page', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('toast stack expands on hover and collapses after', async ({ page }) => {
    await openPage(page, 'motion', 'light');
    await page.getByRole('button', { name: '送出三則通知' }).click();
    const region = page.locator('[data-brume-toaster]');
    await expect(page.getByRole('status')).toHaveCount(3);
    await expect(region).not.toHaveAttribute('data-expanded');
    await page.getByRole('status').last().hover();
    await expect(region).toHaveAttribute('data-expanded', 'true');
    await page.mouse.move(10, 10);
    await expect(region).not.toHaveAttribute('data-expanded');
  });

  test('a toast is dismissed by swiping it to the right', async ({ page }) => {
    await openPage(page, 'motion', 'light');
    await page.getByRole('button', { name: '再一則' }).click();
    const toast = page.getByRole('status').filter({ hasText: '有 3 筆新資料。' });
    await expect(toast).toBeVisible();
    await settle(page);
    const box = await toast.boundingBox();
    if (!box) throw new Error('no toast');
    await page.mouse.move(box.x + 40, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 4 });
    await page.mouse.move(box.x + 160, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect(toast).toHaveCount(0);
  });

  test('the pagination pill slides under the new current page', async ({ page }) => {
    await openPage(page, 'motion', 'light');
    const nav = page.getByRole('navigation', { name: '分頁' });
    const pill = nav.locator('li[aria-hidden="true"]').first();
    await nav.getByRole('link', { name: /4/ }).click();
    await settle(page);
    expect(await misalignment(nav.locator('[aria-current="page"]'), pill)).toEqual([0, 0, 0, 0]);
  });
});

test('the sidebar indicator follows the current item and a closed group', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPage(page, 'shell', 'light');
  const aside = page.locator('aside');
  const indicator = aside.locator('nav > div[aria-hidden="true"]');
  await settle(page);
  expect(await misalignment(aside.locator('[aria-current="page"]'), indicator)).toEqual([
    0, 0, 0, 0,
  ]);
  await aside.getByRole('button', { name: '內容' }).click();
  await settle(page);
  expect(await misalignment(aside.getByRole('button', { name: '內容' }), indicator)).toEqual([
    0, 0, 0, 0,
  ]);
});

test('switching theme does not use a view transition under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'motion', 'light');
  await page.evaluate(() => {
    const w = window as unknown as { vtCalls: number };
    w.vtCalls = 0;
    const doc = document as unknown as { startViewTransition?: (cb: () => void) => unknown };
    const original = doc.startViewTransition?.bind(document);
    doc.startViewTransition = (cb) => {
      w.vtCalls++;
      return original ? original(cb) : cb();
    };
  });
  await page.getByRole('button', { name: '色彩模式' }).click();
  await page.getByRole('menuitemradio', { name: '深色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => (window as unknown as { vtCalls: number }).vtCalls)).toBe(0);
});

test('switching theme cross-fades with a view transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openPage(page, 'motion', 'light');
  await page.evaluate(() => {
    const w = window as unknown as { vtCalls: number };
    w.vtCalls = 0;
    const doc = document as unknown as { startViewTransition?: (cb: () => void) => unknown };
    const original = doc.startViewTransition?.bind(document);
    doc.startViewTransition = (cb) => {
      w.vtCalls++;
      return original ? original(cb) : cb();
    };
  });
  await page.getByRole('button', { name: '色彩模式' }).click();
  await page.getByRole('menuitemradio', { name: '深色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => (window as unknown as { vtCalls: number }).vtCalls)).toBe(1);
});
