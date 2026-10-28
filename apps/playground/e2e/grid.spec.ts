import type { Locator, Page } from '@playwright/test';
import { expect, openPage, test } from './support';

/** Press Tab until `target` has focus (keyboard only, no programmatic focus). */
async function tabTo(page: Page, target: Locator, maxTabs = 80): Promise<void> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Could not reach ${target} within ${maxTabs} Tab presses.`);
}

const toastWith = (page: Page, text: string | RegExp) =>
  page.getByRole('status').filter({ hasText: text });

test.beforeEach(async ({ page }) => {
  await openPage(page, 'grid', 'light');
});

test('a sortable header sorts with Enter and reports it in aria-sort', async ({ page }) => {
  const header = page.getByRole('columnheader', { name: /^訂單編號/ });
  await expect(header).toHaveAttribute('aria-sort', 'none');
  await tabTo(page, header.getByRole('button'));
  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  await expect(page.getByRole('row').nth(1)).toContainText('ORD-2610001');
  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('aria-sort', 'descending');
});

test('⋯ opens with Enter, arrows and Enter run an action, focus returns to ⋯', async ({ page }) => {
  const more = page.getByRole('button', { name: 'ORD-2610048 的更多操作' });
  await tabTo(page, more);
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /^編輯/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: /^出貨/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(more).toBeFocused();
  await expect(toastWith(page, 'ORD-2610048 已安排出貨')).toBeVisible();
  // The refresh brings the shipped order.
  await expect(page.getByRole('row', { name: /ORD-2610048/ })).toContainText('已出貨');
});

test('E in the open menu opens the row for editing', async ({ page }) => {
  const more = page.getByRole('button', { name: 'ORD-2610048 的更多操作' });
  await tabTo(page, more);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('e');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(toastWith(page, '開啟 ORD-2610048 的編輯表單')).toBeVisible();
});

test('Space selects two rows and the batch bar appears', async ({ page }) => {
  const bar = page.getByRole('region', { name: '批次操作' });
  await expect(bar).toBeHidden();
  await tabTo(page, page.getByRole('checkbox', { name: '選取 ORD-2610048' }));
  await page.keyboard.press('Space');
  await tabTo(page, page.getByRole('checkbox', { name: '選取 ORD-2610047' }));
  await page.keyboard.press('Space');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('已選取 2 筆');
  await expect(bar.getByRole('button', { name: '標記為已出貨' })).toBeVisible();
});

test('inline edit: Enter opens, typing and Enter save; Esc cancels back to the cell', async ({
  page,
}) => {
  const row = page.getByRole('row', { name: /ORD-2610048/ });
  const cell = row.getByRole('button', { name: /^編輯客戶：/ });
  await tabTo(page, cell);
  await page.keyboard.press('Enter');
  const input = row.getByRole('textbox', { name: '客戶' });
  await expect(input).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('許小雯');
  await page.keyboard.press('Enter');
  const saved = row.getByRole('button', { name: '編輯客戶：許小雯' });
  await expect(saved).toBeFocused();
  await expect(saved).not.toHaveAttribute('aria-busy', 'true');

  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await page.keyboard.type('不要存');
  await page.keyboard.press('Escape');
  await expect(input).toBeHidden();
  await expect(saved).toBeFocused();
});

test('a 422 from the cell endpoint shows next to the cell', async ({ page }) => {
  const row = page.getByRole('row', { name: /ORD-2610048/ });
  await tabTo(page, row.getByRole('button', { name: /^編輯客戶：/ }));
  await page.keyboard.press('Enter');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('一二三四五六七八九十十一');
  await page.keyboard.press('Enter');
  const error = row.getByRole('alert');
  await expect(error).toHaveText('客戶名稱最多 10 個字。');
  await expect(row.getByRole('button', { name: '編輯客戶：許雅雯' })).toHaveAttribute(
    'aria-describedby',
    (await error.getAttribute('id')) ?? '',
  );
});

test('filter panel applies from the keyboard; the chip ✕ removes the filter', async ({ page }) => {
  const toggle = page.getByRole('button', { name: '篩選', exact: true });
  await tabTo(page, toggle);
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const field = page.getByRole('textbox', { name: '訂單編號' });
  await tabTo(page, field);
  await page.keyboard.type('0048');
  await page.keyboard.press('Enter');

  const chips = page.getByRole('group', { name: '已套用的篩選' });
  await expect(chips).toContainText('0048');
  await expect(page.getByRole('button', { name: /^篩選\s?，已套用 1 個$/ })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);

  const remove = chips.getByRole('button', { name: '移除篩選：訂單編號' });
  await tabTo(page, remove);
  await page.keyboard.press('Enter');
  await expect(chips).toBeHidden();
  await expect(page.locator('tbody tr')).toHaveCount(10);
});

test('scope pills: arrows move focus, Enter picks the scope', async ({ page }) => {
  const all = page.getByRole('radio', { name: '全部' });
  await tabTo(page, all);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: '待出貨' })).toBeFocused();
  await expect(all).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('radio', { name: '待出貨' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('group', { name: '已套用的篩選' })).toContainText('待出貨');
});

test('right-clicking a row opens the same menu as its ⋯', async ({ page }) => {
  await page.getByRole('row', { name: /ORD-2610047/ }).click({ button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /^編輯/ })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /^複製訂單/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test.describe('at 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the default columns fit: the table does not scroll sideways', async ({ page }) => {
    const wrapper = page.getByRole('table').locator('xpath=..');
    const { scrollWidth, clientWidth } = await wrapper.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    // Not a scroll region, so no extra tab stop.
    await expect(page.getByRole('region', { name: /可左右捲動/ })).toHaveCount(0);
  });
});

test.describe('at 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the refresh icon never wraps onto a line alone', async ({ page }) => {
    const top = async (name: string) =>
      Math.round((await page.getByRole('button', { name, exact: true }).boundingBox())?.y ?? -1);
    const refresh = await top('重新整理');
    expect(refresh).toBe(await top('顯示欄位'));
    // It shares its line with at least one of the toolbar's text buttons.
    const others = [await top('篩選'), await top('同步金流狀態'), await top('匯出 Excel')];
    expect(others).toContain(refresh);
  });
});
