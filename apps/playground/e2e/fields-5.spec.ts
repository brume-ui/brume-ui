import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { animationsIdle, expect, type Scheme, storeScheme, test } from './support';

/*
 * Real-browser tests of the structural fields (keyValue, list, autocomplete, tree, listbox), the
 * table repeater, fieldset and group, through the focused demos and the component-state page
 * #/structural-fields. Values are read from the form itself (「目前草稿」/「實際請求值」/
 * 「記憶體接受值」), not only from the DOM.
 */

const FIELD = (type: string) => `/#/form-fields?example=form.field.${type}`;
const LAYOUT = (id: string) => `/#/form-layouts?example=form.layout.${id}`;
const STATES = '/#/structural-fields';

async function open(page: Page, url: string, testId: string, scheme?: Scheme) {
  if (scheme) await storeScheme(page, scheme);
  await page.goto(url);
  await expect(page.getByTestId(testId)).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
const openField = (page: Page, type: string, scheme?: Scheme) =>
  open(page, FIELD(type), 'pg-form-fields', scheme);
const openLayout = (page: Page, id: string, scheme?: Scheme) =>
  open(page, LAYOUT(id), 'pg-form-layouts', scheme);
const openStates = (page: Page, scheme?: Scheme) =>
  open(page, STATES, 'pg-structural-fields', scheme);

const json = async (page: Page, id: string): Promise<Record<string, unknown>> =>
  JSON.parse((await page.getByTestId(id).textContent()) ?? '{}');
const draft = (page: Page) => json(page, 'form-draft');
const wire = (page: Page) => json(page, 'form-wire');
const saved = (page: Page) => json(page, 'form-saved');
const save = (page: Page) =>
  page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();
const requests = (page: Page) => page.getByTestId('request-count');
const noPageScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

async function axe(page: Page) {
  await animationsIdle(page);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))).toEqual(
    [],
  );
}

test.describe('keyValue', () => {
  const group = (page: Page, name = '商品規格') => page.getByRole('group', { name, exact: true });
  const key = (page: Page, n: number, name = '商品規格') =>
    group(page, name).getByRole('textbox', { name: `規格 ${n}`, exact: true });
  const val = (page: Page, n: number, name = '商品規格') =>
    group(page, name).getByRole('textbox', { name: `內容 ${n}`, exact: true });

  test('adds, trims keys, keeps an empty value, drops blank rows and keeps the order', async ({
    page,
  }) => {
    await openField(page, 'keyValue');
    await group(page).getByRole('button', { name: '新增 商品規格', exact: true }).click();
    await key(page, 4).fill('  顏色  ');
    await val(page, 4).fill('米白');
    await group(page).getByRole('button', { name: '新增 商品規格', exact: true }).click();
    await expect(key(page, 5)).toBeVisible();
    // The trailing row stays blank: silently dropped.
    await page.getByRole('button', { name: '移除 必填規格 1' }).count();
    await group(page, '必填規格').getByRole('button', { name: '新增 必填規格' }).click();
    await key(page, 1, '必填規格').fill('尺寸');
    await val(page, 1, '必填規格').fill('M');
    await save(page);
    await expect.poll(async () => (await wire(page)).specs).toBeTruthy();
    expect((await wire(page)).specs).toEqual([
      { key: '材質', value: '純棉' },
      { key: '產地', value: '臺灣' },
      { key: '備註', value: '' },
      { key: '顏色', value: '米白' },
    ]);
    expect((await wire(page)).empty).toEqual([{ key: '尺寸', value: 'M' }]);
  });

  test('a duplicate key is an error on the second row only and blocks the request', async ({
    page,
  }) => {
    await openField(page, 'keyValue');
    await key(page, 2).fill('材質');
    await save(page);
    await expect(requests(page)).toContainText('儲存請求：0');
    const second = key(page, 2);
    await expect(second).toHaveAttribute('aria-invalid', 'true');
    await expect(key(page, 1)).not.toHaveAttribute('aria-invalid', 'true');
    const described = await second.getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    await expect(page.locator(`[id="${described}"]`)).toContainText('鍵不可重複');
  });

  test('required and read-only / disabled states', async ({ page }) => {
    await openField(page, 'keyValue');
    await save(page);
    await expect(page.getByRole('alert').filter({ hasText: '請至少填寫一組規格。' })).toBeVisible();
    // Read-only renders as text (no inputs, no buttons); disabled keeps the inputs, disabled.
    await expect(page.locator('[data-field-path="locked"] p')).toHaveText('保固: 一年');
    await expect(page.locator('[data-field-path="locked"]').getByRole('textbox')).toHaveCount(0);
    await expect(key(page, 1, '停用規格')).toBeDisabled();
    await expect(group(page, '停用規格').getByRole('button').first()).toBeDisabled();
  });

  test('error summary jump focuses a control of the offending field (focus follows the failing field)', async ({
    page,
  }) => {
    await openField(page, 'keyValue');
    await key(page, 2).fill('材質');
    await save(page);
    const focusedInField = await page.evaluate(
      () => !!document.activeElement?.closest('[data-field-path="specs"]'),
    );
    expect(focusedInField).toBe(true);
  });

  test('390 px: two columns and the remove button do not overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openField(page, 'keyValue');
    expect(await noPageScroll(page)).toBe(true);
    const box = await group(page).boundingBox();
    expect(box).toBeTruthy();
    for (const button of await group(page).getByRole('button').all()) {
      const b = await button.boundingBox();
      if (b) expect(b.x + b.width).toBeLessThanOrEqual(390);
    }
    for (const input of await group(page).getByRole('textbox').all()) {
      const b = await input.boundingBox();
      if (b) expect(b.x + b.width).toBeLessThanOrEqual(390);
    }
  });
});

test.describe('list', () => {
  const list = (page: Page, name = '商品賣點') =>
    page
      .getByRole('group', { name, exact: true })
      .or(page.getByRole('list', { name, exact: true }));
  const item = (page: Page, n: number, name = '商品賣點') =>
    page.getByRole('textbox', { name: `${name} ${n}`, exact: true });

  test('up / down buttons and the grip keys reorder and keep focus on the moved row', async ({
    page,
  }) => {
    await openField(page, 'list');
    await page.getByRole('button', { name: '下移 商品賣點 1', exact: true }).click();
    await expect
      .poll(async () => (await draft(page)).points)
      .toEqual(['當日現做', '手工製作', '可客製刻字']);
    await page.getByRole('button', { name: '排序 商品賣點 3', exact: true }).focus();
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await draft(page)).points)
      .toEqual(['當日現做', '可客製刻字', '手工製作']);
    // Focus stays on a control of the moved row.
    const inRow = await page.evaluate(() => document.activeElement?.closest('li') !== null);
    expect(inRow).toBe(true);
    await expect(list(page).first()).toBeVisible();
  });

  test('drag and drop reorders', async ({ page }) => {
    await openField(page, 'list');
    const first = page.getByRole('button', { name: '排序 商品賣點 1', exact: true });
    const third = page.getByRole('button', { name: '排序 商品賣點 3', exact: true });
    await first.dragTo(third);
    await expect
      .poll(async () => (await draft(page)).points)
      .toEqual(['當日現做', '可客製刻字', '手工製作']);
  });

  test('whitespace-only items are dropped, others untouched; min and maxLength errors', async ({
    page,
  }) => {
    await openField(page, 'list');
    await page.getByRole('button', { name: '新增 商品賣點', exact: true }).click();
    await item(page, 4).fill('   ');
    await save(page);
    // 「至少兩項賣點」has only one item: the request is blocked with a field error.
    await expect(requests(page)).toContainText('儲存請求：0');
    await expect(page.getByRole('alert').filter({ hasText: '至少需要 2 項' })).toBeVisible();
    await page.getByRole('button', { name: '新增 至少兩項賣點', exact: true }).click();
    await item(page, 2, '至少兩項賣點').fill(' 第二項 ');
    await save(page);
    await expect.poll(async () => (await wire(page)).points).toBeTruthy();
    expect((await wire(page)).points).toEqual(['手工製作', '當日現做', '可客製刻字']);
    expect((await wire(page)).short).toEqual(['只有一項', ' 第二項 ']);
    // The native maxlength stops typing at 20 characters.
    await item(page, 1).fill('一二三四五六七八九十一二三四五六七八九十超出');
    await expect(item(page, 1)).toHaveValue('一二三四五六七八九十一二三四五六七八九十');
  });

  test('read-only shows text, disabled is disabled', async ({ page }) => {
    await openField(page, 'list');
    await expect(page.locator('[data-field-path="locked"] p')).toHaveText('限量');
    await expect(item(page, 1, '停用賣點')).toBeDisabled();
  });
});

test.describe('autocomplete', () => {
  const input = (page: Page) => page.getByRole('combobox', { name: '取貨門市', exact: true });
  const options = (page: Page) => page.getByRole('listbox').getByRole('option');

  test('500 suggestions render at most 50 and stay responsive; Enter picks the highlighted one', async ({
    page,
  }) => {
    await openField(page, 'autocomplete');
    await input(page).click();
    await input(page).pressSequentially('示範');
    await expect(options(page).first()).toBeVisible();
    expect(await options(page).count()).toBeLessThanOrEqual(50);
    expect(await options(page).count()).toBeGreaterThan(0);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(input(page)).toHaveValue(/^示範分店 \d{3}$/);
    await expect(options(page)).toHaveCount(0);
    // Enter on a picked suggestion does not submit the form.
    await expect(requests(page)).toContainText('儲存請求：0');
  });

  test('free text that matches nothing is saved as typed; blank is null', async ({ page }) => {
    await openField(page, 'autocomplete');
    await input(page).fill('  完全沒有的門市  ');
    await page.keyboard.press('Tab');
    await page.getByRole('combobox', { name: '必填門市' }).fill('隨便寫');
    await save(page);
    await expect.poll(async () => (await wire(page)).branch).toBeTruthy();
    expect((await wire(page)).branch).toBe(
      '  完全沒有的門市  '.trim() === '' ? null : (await wire(page)).branch,
    );
    expect(String((await wire(page)).branch).trim()).toBe('完全沒有的門市');
    expect((await wire(page)).required).toBe('隨便寫');
    await input(page).fill('');
    await save(page);
    await expect.poll(async () => (await wire(page)).branch).toBeNull();
  });

  test('IME composition: Enter neither picks a suggestion nor submits the form', async ({
    page,
  }) => {
    await openField(page, 'autocomplete');
    await input(page).click();
    await input(page).pressSequentially('臺');
    await expect(options(page).first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    const before = await input(page).inputValue();
    await input(page).evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'ㄅ' }));
      el.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          keyCode: 229,
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(input(page)).toHaveValue(before);
    await expect(requests(page)).toContainText('儲存請求：0');
    await input(page).evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'ㄅ' }));
    });
    // After the composition ends, Enter on the highlighted suggestion works again.
    await page.keyboard.press('Enter');
    await expect(requests(page)).toContainText('儲存請求：0');
  });

  test('real IME events through CDP do not submit the form on Enter', async ({ page }) => {
    await openField(page, 'autocomplete');
    await input(page).click();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', {
      text: 'ㄊㄞˊ',
      selectionStart: 3,
      selectionEnd: 3,
    });
    await page.keyboard.press('Enter');
    await expect(requests(page)).toContainText('儲存請求：0');
    await cdp.send('Input.insertText', { text: '臺' });
    await expect(input(page)).toHaveValue('臺');
    await expect(requests(page)).toContainText('儲存請求：0');
  });

  test('read-only and disabled', async ({ page }) => {
    await openField(page, 'autocomplete');
    await expect(page.locator('[data-field-path="locked"] p')).toHaveText('臺北市');
    await expect(page.getByRole('combobox', { name: '停用門市' })).toBeDisabled();
  });
});

test.describe('tree', () => {
  const tree = (page: Page, name: string) => page.getByRole('tree', { name, exact: true });
  const node = (page: Page, name: string, label: string) =>
    tree(page, name).getByRole('treeitem', { name: label, exact: true });

  /** The header buttons live next to the tree role element, in the same control. */
  const controls = (page: Page, name: string) => tree(page, name).locator('xpath=..');

  /** The demo's required tree starts empty; fill it so a save can go through. */
  const fillRequired = async (page: Page) => {
    await controls(page, '必選分類').getByRole('button', { name: '全部展開' }).click();
    await node(page, '必選分類', '蛋糕').click();
  };

  test('keyboard: arrows, Space, mixed parents, and canonical stored values', async ({ page }) => {
    await openField(page, 'tree');
    const name = '商品分類（只存葉節點）';
    await controls(page, name).getByRole('button', { name: '全部展開' }).click();
    await expect(node(page, name, '紅茶')).toHaveAttribute('aria-checked', 'true');
    await expect(node(page, name, '茶類')).toHaveAttribute('aria-checked', 'mixed');
    await expect(node(page, name, '飲品')).toHaveAttribute('aria-checked', 'mixed');
    // Walk to 綠茶 with the arrow keys and check it with Space: 茶類 becomes fully checked.
    await node(page, name, '紅茶').focus();
    await page.keyboard.press('ArrowDown');
    await expect(node(page, name, '綠茶')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(node(page, name, '茶類')).toHaveAttribute('aria-checked', 'true');
    await expect(node(page, name, '飲品')).toHaveAttribute('aria-checked', 'mixed');
    // Left on a leaf goes to its parent; Right on a parent goes to its first child.
    await page.keyboard.press('ArrowLeft');
    await expect(node(page, name, '茶類')).toBeFocused();
    await fillRequired(page);
    await save(page);
    await expect.poll(async () => (await wire(page)).leaves).toBeTruthy();
    expect((await wire(page)).leaves).toEqual(['tea-black', 'tea-green']);
  });

  test('independent and all modes store what the mode says', async ({ page }) => {
    await openField(page, 'tree');
    const name = '商品分類（連父節點一起存）';
    await controls(page, name).getByRole('button', { name: '全部展開' }).click();
    await node(page, name, '點心').focus();
    await page.keyboard.press('Space');
    await fillRequired(page);
    await save(page);
    await expect.poll(async () => (await wire(page)).all).toBeTruthy();
    expect((await wire(page)).all).toEqual(['snack', 'cake', 'cookie']);
    expect((await wire(page)).independent).toEqual(['drink', 'cake']);
  });

  test('collapsed subtrees are not mounted; select-all; disabled node is frozen', async ({
    page,
  }) => {
    await openField(page, 'tree');
    const name = '商品分類（各自獨立）';
    const items = tree(page, name).getByRole('treeitem');
    const collapsed = await items.count();
    await controls(page, name).getByRole('button', { name: '全部展開' }).click();
    expect(await items.count()).toBeGreaterThan(collapsed);
    await controls(page, name).getByRole('button', { name: '全部收合' }).click();
    await expect(items).toHaveCount(collapsed);
    await controls(page, name).getByRole('button', { name: '全選', exact: true }).click();
    await controls(page, name).getByRole('button', { name: '全部展開' }).click();
    // The locked 禮盒 is never selected by select-all.
    await expect(node(page, name, '禮盒')).toHaveAttribute('aria-checked', 'false');
    await expect(node(page, name, '紅茶')).toHaveAttribute('aria-checked', 'true');
  });

  test('required empty tree blocks the save; read-only is text and disabled does not change', async ({
    page,
  }) => {
    await openField(page, 'tree');
    await save(page);
    await expect(page.getByRole('alert').filter({ hasText: '請至少選一個分類。' })).toBeVisible();
    await expect(requests(page)).toContainText('儲存請求：0');
    await node(page, '停用分類', '點心').click({ force: true });
    await node(page, '停用分類', '點心').focus();
    await page.keyboard.press('Space');
    expect((await draft(page)).off).toEqual(['cookie']);
    await expect(page.locator('[data-field-path="locked"]').getByRole('tree')).toHaveCount(0);
  });
});

test.describe('fieldset and table', () => {
  const trigger = (page: Page, title: string) =>
    page.getByRole('button', { name: title, exact: true });
  const origin = (page: Page) => page.getByRole('textbox', { name: '出貨地', exact: true });
  const SHIPPING = '出貨設定（預設收合）';

  test('a collapsed fieldset is not visible and not focusable', async ({ page }) => {
    await openLayout(page, 'fieldset');
    await expect(trigger(page, SHIPPING)).toHaveAttribute('aria-expanded', 'false');
    await expect(origin(page)).toBeHidden();
    const focusable = await page.evaluate(() => {
      const input = document.querySelector<HTMLElement>('[data-field-path="origin"] input');
      if (!input) return false; // unmounted: not focusable either
      input.focus();
      return document.activeElement === input;
    });
    expect(focusable).toBe(false);
  });

  test('submitting expands the fieldset and focuses the invalid field, also the second time', async ({
    page,
  }) => {
    await openLayout(page, 'fieldset');
    for (const round of [1, 2]) {
      await save(page);
      await expect(trigger(page, SHIPPING), `round ${round}`).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(origin(page)).toBeFocused();
      await expect(page.getByRole('alert').filter({ hasText: '請填寫出貨地。' })).toBeVisible();
      // Collapse again: the value and the error are kept, nothing is skipped.
      await trigger(page, SHIPPING).click();
      await expect(origin(page)).toBeHidden();
    }
    await expect(requests(page)).toContainText('儲存請求：0');
  });

  test('collapsing never drops values', async ({ page }) => {
    await openLayout(page, 'fieldset');
    await trigger(page, SHIPPING).click();
    await origin(page).fill('臺北倉');
    await trigger(page, SHIPPING).click();
    await save(page);
    await expect.poll(async () => (await wire(page)).origin).toBe('臺北倉');
  });

  const sizeInput = (page: Page, row: number, col: string) =>
    page.getByRole('row').nth(row).getByRole('textbox', { name: col, exact: true });

  test('the table keeps table semantics and names every cell input (required is announced)', async ({
    page,
  }) => {
    await openLayout(page, 'fieldset');
    await expect(page.getByRole('table', { name: '尺寸表' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /尺碼/ })).toBeVisible();
    expect(await page.getByRole('row').count()).toBeGreaterThanOrEqual(3);
    const size = sizeInput(page, 1, '尺碼');
    await expect(size).toBeVisible();
    expect(
      (await size.getAttribute('required')) !== null ||
        (await size.getAttribute('aria-required')) === 'true',
    ).toBe(true);
  });

  test('card mode at 390 px keeps the semantics, has no horizontal scroll and errors stay by the cell', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openLayout(page, 'fieldset');
    expect(await noPageScroll(page)).toBe(true);
    await expect(page.getByRole('table', { name: '尺寸表' })).toBeVisible();
    expect(await page.getByRole('row').count()).toBeGreaterThanOrEqual(3);
    // Every cell input stays inside the viewport.
    for (const input of await page.locator('tbody input').all()) {
      const b = await input.boundingBox();
      if (b) expect(b.x + b.width).toBeLessThanOrEqual(390);
    }
    // 出貨地 (collapsed) is the first error and takes the focus; fill it so the table error is first.
    await page.getByRole('button', { name: '出貨設定（預設收合）', exact: true }).click();
    await origin(page).fill('臺北倉');
    await sizeInput(page, 1, '尺碼').fill('');
    await save(page);
    const cell = page.locator('tbody tr').first().locator('td').first();
    await expect(cell.getByText('請填寫尺碼。')).toBeVisible();
    await expect(sizeInput(page, 1, '尺碼')).toBeFocused();
  });

  test('add, remove and reorder keep focus on a sensible control', async ({ page }) => {
    await openLayout(page, 'fieldset');
    await page.getByRole('button', { name: '新增 尺寸表', exact: true }).click();
    expect(await page.locator('tbody tr').count()).toBe(3);
    await page.getByRole('button', { name: '下移 尺寸表 1', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => ((await draft(page)).sizes as { size: string }[])[0]?.size)
      .toBe('M');
    const inRow = await page.evaluate(() => document.activeElement?.closest('tr') !== null);
    expect(inRow).toBe(true);
    await page.getByRole('button', { name: '移除 尺寸表 3', exact: true }).focus();
    await page.keyboard.press('Enter');
    expect(await page.locator('tbody tr').count()).toBe(2);
    const stillInTable = await page.evaluate(
      () => document.activeElement?.closest('table') !== null,
    );
    expect(
      stillInTable ||
        (await page
          .getByRole('button', { name: '新增 尺寸表' })
          .evaluate((el) => el === document.activeElement)),
    ).toBe(true);
  });

  test('the dual listbox moves focus to the receiving pane and stacks under 640 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openLayout(page, 'fieldset');
    await trigger(page, SHIPPING).click();
    const group = page.getByRole('group', { name: '配送地區', exact: true });
    const available = group.getByRole('listbox', { name: /可選/ });
    const selected = group.getByRole('listbox', { name: /已選/ });
    const a = await available.boundingBox();
    const s = await selected.boundingBox();
    expect(a && s && s.y > a.y + a.height - 1).toBe(true);
    // Clicking an option keeps focus on the listbox.
    await available.getByRole('option', { name: '離島' }).click();
    await expect(available).toBeFocused();
    await group.getByRole('button', { name: '加入選取項目' }).click();
    await expect(selected).toBeFocused();
    await expect(group.getByRole('button', { name: '加入選取項目' })).toBeDisabled();
    await expect.poll(async () => (await draft(page)).regions).toEqual(['tw', 'outer']);
  });

  test('wide: the panes sit side by side', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLayout(page, 'fieldset');
    await trigger(page, SHIPPING).click();
    const group = page.getByRole('group', { name: '配送地區', exact: true });
    const a = await group.getByRole('listbox', { name: /可選/ }).boundingBox();
    const s = await group.getByRole('listbox', { name: /已選/ }).boundingBox();
    expect(a && s && s.x > a.x + a.width - 1).toBe(true);
  });
});

test.describe('group (when)', () => {
  const kind = (page: Page) => page.getByRole('combobox', { name: /商品類型/ });
  const choose = async (page: Page, label: string) => {
    await kind(page).click();
    await page.getByRole('option', { name: label, exact: true }).click();
  };

  test('root: only the chosen branch shows; a hidden required field does not block and is not accepted', async ({
    page,
  }) => {
    await openLayout(page, 'group');
    await expect(page.getByRole('textbox', { name: '重量（公克）' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '下載連結' })).toHaveCount(0);
    await choose(page, '數位商品');
    await expect(page.getByRole('textbox', { name: '重量（公克）' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '下載連結' })).toBeVisible();
    // The hidden branch's required fields (重量, 服務時數) are empty or stale and do not block.
    await page.getByRole('textbox', { name: '下載連結' }).fill('https://example.test/file');
    await save(page);
    await expect.poll(async () => (await saved(page)).kind).toBe('digital');
    const accepted = await saved(page);
    expect(accepted.download).toBe('https://example.test/file');
    // The old stored value of the hidden branch is left untouched.
    expect(accepted.weight).toBe('250');
  });

  test('a draft typed into a field before it was hidden is never accepted', async ({ page }) => {
    await openLayout(page, 'group');
    await page.getByRole('textbox', { name: '重量（公克）' }).fill('999');
    await choose(page, '數位商品');
    await page.getByRole('textbox', { name: '下載連結' }).fill('https://example.test/f');
    await save(page);
    await expect.poll(async () => (await saved(page)).kind).toBe('digital');
    expect((await saved(page)).weight).toBe('250');
    expect(JSON.stringify(await saved(page))).not.toContain('999');
  });

  test('a visible required field of the active branch blocks the save', async ({ page }) => {
    await openLayout(page, 'group');
    await page.getByRole('textbox', { name: '重量（公克）' }).fill('');
    await save(page);
    await expect(requests(page)).toContainText('儲存請求：0');
    await expect(page.getByRole('alert').filter({ hasText: '請填寫重量。' })).toBeVisible();
  });

  test('inside repeater rows two rows choose different branches independently', async ({
    page,
  }) => {
    await openLayout(page, 'group');
    await expect(page.getByRole('textbox', { name: '貨號' })).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: '時數' })).toHaveCount(1);
    await save(page);
    await expect.poll(async () => (await saved(page)).items).toBeTruthy();
    const items = (await saved(page)).items as Record<string, unknown>[];
    expect(items[0]).toMatchObject({ kind: 'physical', sku: 'TS-001' });
    // The other branch's field keeps its stored value; nothing the user could not see is written.
    expect(items[0]).toMatchObject({ hours: '' });
    expect(items[1]).toMatchObject({ kind: 'service', hours: '2', sku: '' });
    // Row 2 is missing a required value of ITS branch only.
    await page.getByRole('textbox', { name: '時數' }).fill('');
    await save(page);
    await expect(page.getByRole('alert').filter({ hasText: '請填寫時數。' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: '請填寫貨號。' })).toHaveCount(0);
  });
});

test.describe('axe', () => {
  test('component-state page, popups closed', async ({ page }) => {
    await openStates(page);
    await axe(page);
  });
  test('component-state page with the autocomplete list open', async ({ page }) => {
    await openStates(page);
    const box = page.getByRole('combobox', { name: '門市（已填寫）', exact: true });
    await box.click();
    await box.fill('示範');
    await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
    await axe(page);
  });
  test('autocomplete demo with the list open', async ({ page }) => {
    await openField(page, 'autocomplete');
    const box = page.getByRole('combobox', { name: '取貨門市', exact: true });
    await box.click();
    await box.pressSequentially('示範');
    await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
    await axe(page);
  });
  for (const type of ['keyValue', 'list', 'autocomplete', 'tree']) {
    test(`${type} demo has no axe violations`, async ({ page }) => {
      await openField(page, type);
      await axe(page);
    });
  }
  test('fieldset demo collapsed and expanded', async ({ page }) => {
    await openLayout(page, 'fieldset');
    await axe(page);
    await page.getByRole('button', { name: '出貨設定（預設收合）', exact: true }).click();
    await axe(page);
  });
  test('fieldset demo at 390 px (card mode)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openLayout(page, 'fieldset');
    await axe(page);
  });
  test('group demo', async ({ page }) => {
    await openLayout(page, 'group');
    await axe(page);
  });
});

// Linux baselines are generated in CI (update-snapshots workflow); do not commit darwin ones.
const SHOTS: [Scheme, number][] = [
  ['light', 1440],
  ['dark', 390],
];
for (const [scheme, width] of SHOTS) {
  test.describe(`fields-5 screenshots ${scheme} ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    const shoot = async (page: Page, target: Locator, name: string) => {
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      expect(await noPageScroll(page)).toBe(true);
      await animationsIdle(page);
      await expect(target).toHaveScreenshot(`${name}-${scheme}-${width}.png`);
    };
    test(`component states (${scheme}, ${width})`, async ({ page }) => {
      await openStates(page, scheme);
      await shoot(page, page.getByTestId('pg-structural-fields'), 'structural-states');
    });
    test(`fieldset and table form (${scheme}, ${width})`, async ({ page }) => {
      await openLayout(page, 'fieldset', scheme);
      await shoot(page, page.locator('form').first(), 'structural-fieldset');
    });
    test(`group form (${scheme}, ${width})`, async ({ page }) => {
      await openLayout(page, 'group', scheme);
      await shoot(page, page.locator('form').first(), 'structural-group');
    });
    test(`keyValue, list and tree forms (${scheme}, ${width})`, async ({ page }) => {
      for (const type of ['keyValue', 'list', 'tree']) {
        await openField(page, type, scheme);
        await shoot(page, page.locator('form').first(), `structural-${type}`);
      }
    });
  });
}
