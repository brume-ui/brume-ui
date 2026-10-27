import type { Locator, Page } from '@playwright/test';
import { expect, openPage, test } from './support';

/** Press Tab until `target` has focus (keyboard only, no programmatic focus). */
async function tabTo(page: Page, target: Locator, maxTabs = 40): Promise<void> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Could not reach ${target} within ${maxTabs} Tab presses.`);
}

test('dialog opens with Enter, closes with Esc, and returns focus to its trigger', async ({
  page,
}) => {
  await openPage(page, 'dialog', 'light');
  const trigger = page.getByRole('button', { name: '開啟 md' });
  await tabTo(page, trigger);
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: '編輯使用者' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('textbox', { name: '名稱' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('dialog traps Tab focus inside itself', async ({ page }) => {
  await openPage(page, 'dialog', 'light');
  await tabTo(page, page.getByRole('button', { name: '開啟 md' }));
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: '編輯使用者' });
  await expect(dialog).toBeVisible();
  // input, cancel, save, maximize, close: two full cycles forwards and one backwards.
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);
  }
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);
  }
});

test('select picks a value with the keyboard', async ({ page }) => {
  await openPage(page, 'select', 'light');
  const trigger = page.getByRole('combobox', { name: '角色' });
  await expect(trigger).toHaveText('管理員');
  await tabTo(page, trigger);
  await page.keyboard.press('Enter');

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: '編輯' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(listbox).toBeHidden();
  await expect(trigger).toHaveText('編輯');
  await expect(trigger).toBeFocused();
});

test('a toast does not move focus', async ({ page }) => {
  await openPage(page, 'toast', 'light');
  const trigger = page.getByRole('button', { name: 'success' });
  await tabTo(page, trigger);
  await page.keyboard.press('Enter');

  await expect(page.getByRole('status').filter({ hasText: '已儲存使用者。' })).toBeVisible();
  await expect(trigger).toBeFocused();
});

test('toasts do not animate transform under prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'toast', 'light');
  await tabTo(page, page.getByRole('button', { name: 'info', exact: true }));
  await page.keyboard.press('Enter');

  const toast = page.getByRole('status').filter({ hasText: '有 3 筆新資料。' });
  await expect(toast).toBeVisible();
  const style = await toast.evaluate((el) => {
    const s = getComputedStyle(el);
    return { animationName: s.animationName, transform: s.transform };
  });
  expect(style).toEqual({ animationName: 'none', transform: 'none' });
});

test('toasts do animate in without reduced motion (control)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openPage(page, 'toast', 'light');
  await tabTo(page, page.getByRole('button', { name: 'info', exact: true }));
  await page.keyboard.press('Enter');

  const toast = page.getByRole('status').filter({ hasText: '有 3 筆新資料。' });
  await expect(toast).toBeVisible();
  expect(await toast.evaluate((el) => getComputedStyle(el).animationName)).toBe('br-toast-in');
});
