import { expect, openPage, test } from './support';

test('stacked fields remain keyboard reachable and Enter adds a tag', async ({ page }) => {
  await openPage(page, 'form', 'light');
  await page.getByRole('textbox', { name: '標題', exact: true }).focus();
  const visited = new Set<string>();
  for (let index = 0; index < 120; index++) {
    const label = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.id ?? '',
    );
    visited.add(label);
    if (
      await page
        .getByRole('button', { name: '儲存', exact: true })
        .evaluate((el) => el === document.activeElement)
    )
      break;
    await page.keyboard.press('Tab');
  }
  await expect(page.getByRole('button', { name: '儲存', exact: true })).toBeFocused();
  expect(visited.size).toBeGreaterThan(15);
  const tags = page.getByRole('combobox', { name: '關鍵字', exact: true });
  await tags.fill('鍵盤新增');
  await tags.press('Enter');
  await expect(page.getByRole('button', { name: '移除「鍵盤新增」' })).toBeVisible();
});

test('upload completes and keyboard reorder keeps focus on the moved file', async ({ page }) => {
  await openPage(page, 'form', 'light');
  await page.locator('input[type=file][multiple]').setInputFiles({
    name: 'keyboard.png',
    mimeType: 'image/png',
    buffer: Buffer.from('demo image'),
  });
  await expect(page.getByText('keyboard.png', { exact: true })).toBeVisible();
  await expect(page.getByText('上傳中…', { exact: true })).toHaveCount(0);
  const move = page.getByRole('button', { name: '下移 sample-a.png', exact: true });
  await move.focus();
  await page.keyboard.press('Enter');
  const moved = page.locator('li[data-upload-key]').filter({ hasText: 'sample-a.png' });
  await expect(moved).toBeFocused();
  await expect(page.locator('li[data-upload-key]').nth(1)).toContainText('sample-a.png');
});

test('dialog keyboard save, discard confirmation, navigation and focus restoration', async ({
  page,
}) => {
  await openPage(page, 'form-dialog', 'light');
  const trigger = page.getByRole('button', { name: '編輯訂單', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '編輯訂單', exact: true });
  await dialog.getByRole('textbox', { name: '標題', exact: true }).fill('夏季訂單');
  await page.keyboard.press('Meta+Enter');
  await expect(page.getByText('已儲存變更', { exact: true })).toBeVisible();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(dialog).toContainText('#A1043');
  await dialog.getByRole('textbox', { name: '標題', exact: true }).fill('秋季訂單');
  await page.keyboard.press('Escape');
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '放棄變更' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('page contents link jumps to section three and 422 marks its link and focuses the field', async ({
  page,
}) => {
  await openPage(page, 'form-page', 'light');
  const nav = page.getByRole('navigation', { name: '本頁段落' });
  await nav.getByRole('link', { name: '附加資料', exact: true }).click();
  await expect(page.locator('[data-form-section=details]')).toBeInViewport();
  await page.getByRole('textbox', { name: '顏色', exact: true }).fill('error');
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(nav.getByRole('link', { name: /附加資料.*（有錯誤）/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '顏色', exact: true })).toBeFocused();
  await expect(page.getByText('這個顏色目前無法供應。').first()).toBeVisible();
});

test('upload drag reorder keeps the same item identities', async ({ page }) => {
  await openPage(page, 'form', 'light');
  const first = page.locator('li[data-upload-key]').filter({ hasText: 'sample-a.png' });
  const second = page.locator('li[data-upload-key]').filter({ hasText: 'sample-b.png' });
  await first.getByRole('button', { name: '排序 sample-a.png', exact: true }).dragTo(second);
  await expect(page.locator('li[data-upload-key]').first()).toContainText('sample-b.png');
  await expect(first).toBeFocused();
});
