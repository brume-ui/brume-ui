import { readdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { Frame, Locator, Page } from '@playwright/test';
import { animationsIdle, test as base, expect, SCHEMES, type Scheme, storeScheme } from './support';
import { canonicalDiff, judge } from './support/html-judge';

/*
 * Real-browser tests of the rich text editor (Jodit in a lazy chunk, editing area in an iframe) through
 * the focused playground demo #/form-fields?example=form.field.richText. Values are read from the
 * form itself (the demo's 「目前草稿」/「實際請求值」 evidence), not only from the DOM.
 */

const DEMO = '/#/form-fields?example=form.field.richText';
const FIXTURE_DIR = new URL('./fixtures/rich-text/', import.meta.url);
const FIXTURES = readdirSync(FIXTURE_DIR)
  .filter((file) => file.endsWith('.html'))
  .sort()
  .map((file) => ({
    name: file.replace(/\.html$/, ''),
    html: readFileSync(new URL(file, FIXTURE_DIR), 'utf8'),
  }));
const fixture = (name: string) => FIXTURES.find((x) => x.name === name)?.html ?? '';
const NBSP_COUNT = (html: string) => (html.match(/&nbsp;| /g) ?? []).length;
const UPLOADED = '/demo/rich-text/uploaded.svg?upload=';
const PNG = [137, 80, 78, 71, 13, 10, 26, 10];

// The suite must work offline: nothing may leave the origin. YouTube embeds (in fixtures and in
// inserted videos) are answered by a stub so no test depends on YouTube.
const test = base.extend<{ sameOrigin: string[] }>({
  sameOrigin: [
    async ({ page }, use) => {
      const external: string[] = [];
      await page.route(
        /^https?:\/\/([a-z0-9-]+\.)*(youtube\.com|youtube-nocookie\.com)\//,
        (route) =>
          route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><title>stub</title>',
          }),
      );
      page.on('request', (request) => {
        const url = request.url();
        if (/^(data|blob|about):/.test(url)) return;
        const { origin, hostname } = new URL(url);
        if (origin === 'http://localhost:4180') return;
        if (/(^|\.)youtube(-nocookie)?\.com$/.test(hostname) && url.includes('/embed/')) return;
        external.push(url);
      });
      await use(external);
      expect(external, 'requests left the origin').toEqual([]);
    },
    { auto: true },
  ],
});

async function openDemo(page: Page, scheme?: Scheme) {
  if (scheme) await storeScheme(page, scheme);
  await page.goto(DEMO);
  await expect(page.getByTestId('pg-form-fields')).toBeVisible();
  // content, summary, the disabled one and the two repeater rows; the read-only field loads no Jodit.
  await expect(page.locator('.br-rich-text iframe.jodit-wysiwyg_iframe')).toHaveCount(5);
  for (const root of await page.locator('.br-rich-text').all()) await editorReady(root);
}

/** The editor shell (`.br-rich-text`) whose editing iframe is named `label`. */
function editor(page: Page, label: string): Locator {
  return page
    .locator('.br-rich-text')
    .filter({ has: page.locator(`iframe[title="${label}"]`) })
    .first();
}
const content = (page: Page) => editor(page, '商品介紹');
const summary = (page: Page) => editor(page, '簡短說明');
const section = (page: Page, n: number) => page.locator('.br-rich-text').nth(2 + n); // rows 1, 2

/**
 * The lazy chunk loaded, Jodit is ready and the component applied its accessibility pass (it sets a
 * valid <html lang> in the editing document; Jodit's own value is "zh_tw").
 */
async function editorReady(root: Locator) {
  await expect(root.locator('iframe.jodit-wysiwyg_iframe')).toHaveCount(1);
  await expect
    .poll(() =>
      root
        .locator('iframe.jodit-wysiwyg_iframe')
        .evaluate((f: HTMLIFrameElement) =>
          f.contentDocument?.documentElement?.getAttribute('lang'),
        ),
    )
    .toBe('zh-TW');
}

async function frameOf(root: Locator): Promise<Frame> {
  const handle = await root.locator('iframe.jodit-wysiwyg_iframe').elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error('editing iframe has no frame');
  return frame;
}

async function draft(page: Page): Promise<Record<string, unknown>> {
  return JSON.parse((await page.getByTestId('form-draft').textContent()) ?? '{}');
}
async function draftOf(page: Page, path: string): Promise<unknown> {
  let value: unknown = await draft(page);
  for (const key of path.split('.'))
    value = (value as Record<string, unknown> | unknown[] | null)?.[key as never];
  return value;
}

const button = (root: Locator, name: string) =>
  root.locator(`.jodit-toolbar-button_${name} .jodit-toolbar-button__button`);
const popup = (page: Page) => page.locator('.jodit-popup').last();

/** Focus the editing body and put the caret at the end of its first non-empty text node. */
async function caretAtFirstText(
  page: Page,
  root: Locator,
  selector = 'body',
  /** Character offset in that text node; default: its end. */
  offset?: number,
) {
  const frame = await frameOf(root);
  await frame.locator('body').focus();
  await frame.evaluate(
    ({ sel, offset }) => {
      const scope = document.querySelector(sel) ?? document.body;
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
          /\S/.test((n.textContent ?? '').replace(/ /g, ''))
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP,
      });
      const node = walker.nextNode() ?? scope;
      const range = document.createRange();
      range.setStart(node, node.nodeType === 3 ? (offset ?? (node.textContent ?? '').length) : 0);
      range.collapse(true);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    { sel: selector, offset },
  );
  await page.waitForTimeout(50);
}

async function selectAllIn(page: Page, root: Locator) {
  const frame = await frameOf(root);
  await frame.locator('body').focus();
  await page.keyboard.press('ControlOrMeta+a');
}

async function loadFixture(page: Page, name: string) {
  await page.getByLabel('載入舊內容範例').selectOption(name);
  await expect.poll(() => draftOf(page, 'content')).toBe(fixture(name));
  const frame = await frameOf(content(page));
  await expect.poll(() => frame.evaluate(() => document.body.childElementCount)).toBeGreaterThan(0);
}

/** A synthetic paste, as the browser would deliver it, into the editing document. */
async function paste(
  root: Locator,
  data: { html?: string; text?: string; files?: { name: string; type: string }[] },
) {
  const frame = await frameOf(root);
  return frame.evaluate(
    ({ html, text, files, png }) => {
      const dt = new DataTransfer();
      if (html) dt.setData('text/html', html);
      if (text ?? html) dt.setData('text/plain', text ?? 'plain');
      for (const f of files ?? [])
        dt.items.add(new File([new Uint8Array(png)], f.name, { type: f.type }));
      const event = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      (document.activeElement ?? document.body).dispatchEvent(event);
      return event.defaultPrevented;
    },
    { ...data, png: PNG },
  );
}

/** A synthetic file drop at the centre of `target` (a selector inside the editing document). */
async function drop(root: Locator, target: string, file: { name: string; type: string }) {
  const frame = await frameOf(root);
  return frame.evaluate(
    ({ target, file, png }) => {
      const el = document.querySelector(target) ?? document.body;
      const rect = el.getBoundingClientRect();
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(png)], file.name, { type: file.type }));
      const at = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
      const over = new DragEvent('dragover', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
        ...at,
      });
      el.dispatchEvent(over);
      const event = new DragEvent('drop', {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
        ...at,
      });
      el.dispatchEvent(event);
      return { over: over.defaultPrevented, drop: event.defaultPrevented };
    },
    { target, file, png: PNG },
  );
}

const save = (page: Page) =>
  page.getByRole('button', { name: '儲存後繼續編輯', exact: true }).click();
const dirty = (page: Page) => page.getByTestId('form-dirty');

test.describe('rich-text legacy fixtures', () => {
  test('there are 12 hand-written fixtures', () => {
    expect(FIXTURES.map((x) => x.name)).toHaveLength(12);
  });
  for (const { name, html } of FIXTURES) {
    test(`rich-text ${name}: loading keeps the HTML, typing changes only the typed text`, async ({
      page,
    }) => {
      await openDemo(page);
      await loadFixture(page, name);
      // Loading is a reset: the held value is the document as given, nothing dirty.
      await expect(dirty(page)).toHaveText('無未儲存變更');
      const root = content(page);

      // What the editor holds without any edit (its source view shows exactly `editor.value`).
      await button(root, 'source').click();
      const source = root.locator('textarea.jodit-source__mirror');
      await expect(source).toBeVisible();
      const held = await source.inputValue();
      const loaded = await judge(page, html, held);
      // Every fixture round-trips canonically identical today (not merely "harmless": b→strong or a
      // dropped empty element would be harmless to the judge but is a re-enabled cleaning option).
      expect(loaded.verdict, `${name}: ${loaded.cats.join('; ')}\n${canonicalDiff(loaded)}`).toBe(
        'identical',
      );
      expect(NBSP_COUNT(held), `${name}: &nbsp; kept`).toBe(NBSP_COUNT(html));
      await button(root, 'source').click();
      await expect(source).toBeHidden();
      // Toggling the source view without editing does not change the value either.
      expect(await draftOf(page, 'content')).toBe(html);
      await expect(dirty(page)).toHaveText('無未儲存變更');

      // Type one word: the form value differs from the fixture only by that word.
      await caretAtFirstText(page, root);
      await page.keyboard.type('Zebra');
      await expect.poll(() => draftOf(page, 'content')).toContain('Zebra');
      await expect(dirty(page)).toHaveText('有未儲存變更');
      const typed = String(await draftOf(page, 'content'));
      expect(typed.split('Zebra')).toHaveLength(2);
      const rest = await judge(page, html, typed.replace('Zebra', ''));
      expect(rest.verdict, `${name}: ${rest.cats.join('; ')}\n${canonicalDiff(rest)}`).toBe(
        'identical',
      );
      expect(NBSP_COUNT(typed)).toBe(NBSP_COUNT(html));
    });
  }
});

test.describe('rich-text value, dirty and required', () => {
  test('rich-text load and external reset are not edits; typing is; empty is null and required', async ({
    page,
  }) => {
    await openDemo(page);
    expect(await draftOf(page, 'content')).toBe(fixture('01-nested-layout'));
    expect(await draftOf(page, 'summary')).toBe('<p><br></p>');
    await expect(dirty(page)).toHaveText('無未儲存變更');

    // <p><br></p> is empty: required blocks the save with the field's message, nothing is sent.
    await save(page);
    await expect(page.getByText('請填寫簡短說明。').first()).toBeVisible();
    await expect(page.getByTestId('request-count')).toContainText('儲存請求：0');

    const root = summary(page);
    await (await frameOf(root)).locator('body').click();
    await page.keyboard.type('暫時的文字');
    await expect.poll(() => draftOf(page, 'summary')).toContain('暫時的文字');
    await expect(dirty(page)).toHaveText('有未儲存變更');
    await selectAllIn(page, root);
    await page.keyboard.press('Backspace');
    await expect.poll(() => draftOf(page, 'summary')).toBeNull();
    await save(page);
    await expect(page.getByTestId('request-count')).toContainText('儲存請求：0');

    await (await frameOf(root)).locator('body').click();
    await page.keyboard.type('一句話介紹');
    await expect.poll(() => draftOf(page, 'summary')).toBe('<p>一句話介紹</p>');
    await save(page);
    await expect(page.getByTestId('form-saved')).toContainText('一句話介紹');
    await expect(dirty(page)).toHaveText('無未儲存變更');

    // An external reset writes the editor without reporting an edit.
    await (await frameOf(root)).locator('body').click();
    await page.keyboard.type('X');
    await expect(dirty(page)).toHaveText('有未儲存變更');
    await page.getByRole('button', { name: '重設示範資料', exact: true }).click();
    await expect(dirty(page)).toHaveText('無未儲存變更');
    await expect.poll(() => draftOf(page, 'summary')).toBe('<p>一句話介紹</p>');
    await expect
      .poll(async () => (await frameOf(root)).evaluate(() => document.body.innerHTML))
      .toBe('<p>一句話介紹</p>');
    await page.waitForTimeout(300);
    await expect(dirty(page)).toHaveText('無未儲存變更');
  });

  test('rich-text two editors in repeater rows are independent', async ({ page }) => {
    await openDemo(page);
    const first = section(page, 1);
    await caretAtFirstText(page, first);
    await page.keyboard.type('甲');
    await expect.poll(() => draftOf(page, 'sections.0.body')).toContain('甲');
    expect(await draftOf(page, 'sections.1.body')).toBe(
      '<p class="font_lv5">第二段：<em>保存方式</em>，請置於陰涼處。</p>',
    );
    expect(
      await (await frameOf(section(page, 2))).evaluate(() => document.body.innerHTML),
    ).not.toContain('甲');
    await page.getByLabel(/慢速請求/).check();
    await caretAtFirstText(page, section(page, 2));
    await paste(section(page, 2), { files: [{ name: 'row.png', type: 'image/png' }] });
    await expect(section(page, 2)).toHaveAttribute('data-uploading', '1');
    await expect(first).not.toHaveAttribute('data-uploading');
    await expect
      .poll(() => draftOf(page, 'sections.1.body'), { timeout: 5000 })
      .toContain(UPLOADED);
    expect(await draftOf(page, 'sections.0.body')).not.toContain('<img');
  });
});

test.describe('rich-text toolbar', () => {
  test('rich-text paragraph menu, bold, lists with indent, hr, clear formatting', async ({
    page,
  }) => {
    await openDemo(page);
    const root = summary(page);
    await (await frameOf(root)).locator('body').click();
    await page.keyboard.type('標題文字');
    await root.locator('.jodit-toolbar-button_paragraph .jodit-toolbar-button__trigger').click();
    await expect(popup(page).locator('.jodit-toolbar-button__text')).toHaveText([
      '內文段落',
      '標題 1',
      '標題 2',
      '標題 3',
    ]);
    await popup(page).getByText('標題 2', { exact: true }).click();
    await expect.poll(() => draftOf(page, 'summary')).toBe('<h2>標題文字</h2>');

    await selectAllIn(page, root);
    await button(root, 'bold').click();
    await expect.poll(() => draftOf(page, 'summary')).toBe('<h2><strong>標題文字</strong></h2>');
    await selectAllIn(page, root);
    await button(root, 'eraser').click();
    await expect.poll(() => draftOf(page, 'summary')).toBe('<h2>標題文字</h2>');

    // Bullet list, then nest / un-nest the second item with the indent buttons.
    await selectAllIn(page, root);
    await page.keyboard.type('第一');
    await page.keyboard.press('Enter');
    await page.keyboard.type('第二');
    await selectAllIn(page, root);
    await button(root, 'ul').click();
    await expect
      .poll(() => draftOf(page, 'summary'))
      .toMatch(/^<ul><li>第一<\/li><li>第二<\/li><\/ul>$/);
    await caretAtFirstText(page, root, 'li:nth-child(2)');
    await button(root, 'indent').click();
    await expect
      .poll(() => draftOf(page, 'summary'))
      .toBe('<ul><li>第一<ul><li>第二</li></ul></li></ul>');
    await caretAtFirstText(page, root, 'li li');
    await button(root, 'outdent').click();
    await expect.poll(() => draftOf(page, 'summary')).toBe('<ul><li>第一</li><li>第二</li></ul>');

    await caretAtFirstText(page, root, 'li:nth-child(2)');
    await button(root, 'hr').click();
    await expect.poll(() => draftOf(page, 'summary')).toContain('<hr>');
  });

  test('rich-text link add, edit and remove', async ({ page }) => {
    await openDemo(page);
    const root = summary(page);
    const frame = await frameOf(root);
    await frame.locator('body').click();
    await page.keyboard.type('看全部商品');
    await selectAllIn(page, root);
    await button(root, 'link').click();
    await popup(page).locator('input[name="url"]').fill('https://shop.example/all');
    await popup(page)
      .locator('.jodit-ui-button_variant_primary, button[type="submit"]')
      .first()
      .click();
    await expect
      .poll(() => draftOf(page, 'summary'))
      .toBe('<p><a href="https://shop.example/all">看全部商品</a></p>');

    // Edit through the popup over the link.
    await frame.locator('a').click();
    await page.locator('.jodit-popup [aria-label="編輯連結"]').first().click();
    const url = popup(page).locator('input[name="url"]');
    await expect(url).toHaveValue('https://shop.example/all');
    await url.fill('https://shop.example/new');
    await popup(page)
      .locator('.jodit-ui-button_variant_primary, button[type="submit"]')
      .first()
      .click();
    await expect.poll(() => draftOf(page, 'summary')).toContain('href="https://shop.example/new"');

    await frame.locator('a').click();
    await page.locator('.jodit-popup [aria-label="取消連結"]').first().click();
    await expect.poll(() => draftOf(page, 'summary')).toBe('<p>看全部商品</p>');
  });

  test('rich-text table insert, add row and column, delete', async ({ page }) => {
    await openDemo(page);
    const root = summary(page);
    const frame = await frameOf(root);
    await frame.locator('body').click();
    await page.keyboard.type('規格');
    await button(root, 'table').click();
    // 2 rows × 2 columns: the grid is 10 cells wide.
    await popup(page).locator('[role="gridcell"][aria-label="2 by 2"]').click();
    await expect
      .poll(async () => (String(await draftOf(page, 'summary')).match(/<td/g) ?? []).length)
      .toBe(4);
    // The cell popup's buttons open a small menu (above/below, left/right, what to delete).
    const cellMenu = async (button: string, item: RegExp) => {
      await frame.locator('td').first().click();
      await page
        .locator(`.jodit-popup .jodit-toolbar-button_${button} .jodit-toolbar-button__button`)
        .first()
        .click();
      await page.locator('.jodit-popup').getByText(item).first().click();
    };
    await cellMenu('addrow', /^插入下方列$/);
    await expect
      .poll(async () => (String(await draftOf(page, 'summary')).match(/<tr/g) ?? []).length)
      .toBe(3);
    await cellMenu('addcolumn', /右/);
    await expect
      .poll(async () => (String(await draftOf(page, 'summary')).match(/<td/g) ?? []).length)
      .toBe(9);
    await frame.locator('td').first().click();
    await page.locator('.jodit-popup [aria-label="刪除"]').first().click();
    await page.locator('.jodit-popup').getByText(/表格/).first().click();
    await expect.poll(() => draftOf(page, 'summary')).not.toContain('<table');
    expect(await draftOf(page, 'summary')).toContain('規格');
  });

  test('rich-text source view is a plain textarea and round-trips', async ({ page }) => {
    await openDemo(page);
    const root = summary(page);
    await button(root, 'source').click();
    const area = root.locator('textarea.jodit-source__mirror');
    await expect(area).toBeVisible();
    await expect(root.locator('.ace_editor')).toHaveCount(0);
    await area.fill(
      '<p>原始碼<b>編輯</b></p><div class="box100" style="display: flex;">區塊</div>',
    );
    await button(root, 'source').click();
    await expect(area).toBeHidden();
    await expect
      .poll(() => draftOf(page, 'summary'))
      .toBe('<p>原始碼<b>編輯</b></p><div class="box100" style="display: flex;">區塊</div>');
    await button(root, 'source').click();
    await expect(area).toHaveValue(
      '<p>原始碼<b>編輯</b></p><div class="box100" style="display: flex;">區塊</div>',
    );
  });

  test('rich-text YouTube only: watch URL, youtu.be with t, other hosts refused', async ({
    page,
  }) => {
    await openDemo(page);
    const root = summary(page);
    const insert = async (url: string) => {
      await (await frameOf(root)).locator('body').focus();
      await button(root, 'video').click();
      await popup(page).locator('input').first().fill(url);
      await popup(page).getByRole('button', { name: '插入' }).click();
    };
    await insert('https://vimeo.com/123456');
    await expect(popup(page)).toContainText('只支援 YouTube 網址');
    expect(await draftOf(page, 'summary')).toBe('<p><br></p>');
    await page.keyboard.press('Escape');
    await insert('https://www.youtube.com/watch?v=demoVideo01');
    await expect
      .poll(() => draftOf(page, 'summary'))
      .toMatch(/<iframe src="https:\/\/www\.youtube\.com\/embed\/demoVideo01"[^>]*allowfullscreen/);
    await insert('https://youtu.be/demoVideo02?t=42');
    await expect
      .poll(() => draftOf(page, 'summary'))
      .toContain('src="https://www.youtube.com/embed/demoVideo02?start=42"');
  });

  test('rich-text pasted YouTube URL becomes the same embed as the video popup', async ({
    page,
  }) => {
    await openDemo(page);
    const root = summary(page);
    const url = 'https://www.youtube.com/watch?v=demoVideo03&t=42s';
    await (await frameOf(root)).locator('body').click();
    await paste(root, { text: url });
    const embed =
      '<iframe src="https://www.youtube.com/embed/demoVideo03?start=42" width="560" height="315" allowfullscreen=""></iframe>';
    await expect.poll(() => draftOf(page, 'summary')).toContain(embed);
    // The popup inserts exactly the same markup.
    await selectAllIn(page, root);
    await page.keyboard.press('Delete');
    await expect.poll(async () => String(await draftOf(page, 'summary'))).not.toContain('<iframe');
    await button(root, 'video').click();
    await popup(page).locator('input').first().fill(url);
    await popup(page).getByRole('button', { name: '插入' }).click();
    await expect.poll(() => draftOf(page, 'summary')).toContain(embed);
  });

  test('rich-text pasted Vimeo URL stays a link, never an iframe', async ({ page }) => {
    await openDemo(page);
    const root = summary(page);
    await (await frameOf(root)).locator('body').click();
    await paste(root, { text: 'https://vimeo.com/123456' });
    await expect.poll(() => draftOf(page, 'summary')).toContain('href="https://vimeo.com/123456"');
    expect(String(await draftOf(page, 'summary'))).not.toContain('<iframe');
    await paste(root, { text: 'https://www.youtube.com/embed/not-an-id' });
    await expect
      .poll(() => draftOf(page, 'summary'))
      .toContain('href="https://www.youtube.com/embed/not-an-id"');
    expect(String(await draftOf(page, 'summary'))).not.toContain('<iframe');
  });
});

test.describe('rich-text paste, drop and uploads', () => {
  const WORD =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{mso-style-parent:"";font-family:"Times New Roman"}</style></head><body><!--StartFragment-->' +
    '<p class="MsoNormal" style="mso-margin-top-alt:auto;font-family:&quot;Times New Roman&quot;;color:red"><span lang="ZH-TW" style="font-size:14pt;mso-bidi-font-size:12pt">貼上的<b>粗體</b>文字</span></p>' +
    '<h2 class="MsoHeading2" style="color:#123456">貼上的標題</h2>' +
    '<ul><li class="MsoListParagraph" style="color:blue">項目一</li></ul>' +
    '<table class="MsoTableGrid" border="1" style="border-collapse:collapse;mso-yfti-tbllook:1184"><tr><td style="background:yellow">格子</td></tr></table>' +
    '<!--EndFragment--></body></html>';

  test('rich-text Word HTML is cleaned, structure kept, loaded content untouched', async ({
    page,
  }) => {
    await openDemo(page);
    const root = content(page);
    await caretAtFirstText(page, root, 'h2');
    await paste(root, { html: WORD, text: '貼上的粗體文字' });
    await expect.poll(() => draftOf(page, 'content')).toContain('貼上的標題');
    const value = String(await draftOf(page, 'content'));
    expect(value).not.toMatch(/color:\s*(red|blue)/);
    for (const gone of ['Mso', 'mso-', 'Times', 'yellow', '14pt', 'ZH-TW', '#123456'])
      expect(value, gone).not.toContain(gone);
    expect(value).toMatch(/貼上的<(b|strong)>粗體<\/(b|strong)>文字/);
    expect(value).toContain('貼上的標題</h2>');
    expect(value).toMatch(/<li>項目一<\/li>/);
    expect(value).toMatch(/<td>格子<\/td>/);
    // Nothing of the loaded document was lost: only additions.
    const verdict = await judge(page, fixture('01-nested-layout'), value);
    expect(
      verdict.cats.filter((c) => / lost/.test(c)),
      canonicalDiff(verdict),
    ).toEqual([]);
    await expect(page.getByTestId('request-count')).toContainText('上傳：0');
  });

  test('rich-text html with a PNG pastes the html and uploads nothing', async ({ page }) => {
    await openDemo(page);
    const root = section(page, 1);
    await caretAtFirstText(page, root);
    await paste(root, {
      html: '<html><body><!--StartFragment--><table><tr><td>A1</td><td>B1</td></tr></table><!--EndFragment--></body></html>',
      text: 'A1\tB1',
      files: [{ name: 'excel-preview.png', type: 'image/png' }],
    });
    await expect.poll(() => draftOf(page, 'sections.0.body')).toContain('<td>A1</td>');
    await page.waitForTimeout(400);
    await expect(page.getByTestId('request-count')).toContainText('上傳：0');
    expect(await draftOf(page, 'sections.0.body')).not.toContain('<img');
  });

  test('rich-text image paste: placeholder, then the response URL; several files; pending blocks save', async ({
    page,
  }) => {
    await openDemo(page);
    // Make the required field valid so only the upload can block the save.
    await (await frameOf(summary(page))).locator('body').click();
    await page.keyboard.type('簡短');
    const root = content(page);
    await page.getByLabel(/慢速請求/).check();
    await caretAtFirstText(page, root, 'h2');
    await paste(root, { files: [{ name: 'photo.png', type: 'image/png' }] });
    await expect(root).toHaveAttribute('data-uploading', '1');
    const frame = await frameOf(root);
    await expect(frame.locator('[data-br-upload]')).toHaveText('上傳中…');
    expect(await draftOf(page, 'content')).not.toContain('data-br-upload');
    await save(page);
    await expect(page.getByText('檔案還在上傳，完成後才能儲存。').first()).toBeVisible();
    await expect(page.getByTestId('request-count')).toContainText('儲存請求：0');
    await expect.poll(() => draftOf(page, 'content'), { timeout: 5000 }).toContain(`${UPLOADED}1`);
    await expect(root).not.toHaveAttribute('data-uploading');
    await expect(frame.locator('[data-br-upload]')).toHaveCount(0);
    expect(String(await draftOf(page, 'content'))).toMatch(
      new RegExp(
        `<h2[^>]*>霧島選物｜冬季保養組<img src="${UPLOADED.replace(/[?.]/g, '\\$&')}1" alt="photo">`,
      ),
    );

    await page.getByLabel(/慢速請求/).uncheck();
    await paste(root, {
      files: [
        { name: 'a.png', type: 'image/png' },
        { name: 'b.jpg', type: 'image/jpeg' },
      ],
    });
    await expect.poll(() => draftOf(page, 'content')).toContain(`${UPLOADED}3`);
    expect(await draftOf(page, 'content')).toContain(`${UPLOADED}2`);
    await save(page);
    await expect(page.getByTestId('form-saved')).toContainText(`${UPLOADED}3`);
  });

  test('rich-text failed upload (422) leaves nothing and shows the message', async ({ page }) => {
    await openDemo(page);
    const root = content(page);
    await page.getByLabel('模擬上傳失敗').check();
    await caretAtFirstText(page, root, 'h2');
    await paste(root, { files: [{ name: 'rejected.png', type: 'image/png' }] });
    await expect(
      page.getByText('模擬伺服器拒絕：圖片未通過檢查，請換一張。').first(),
    ).toBeVisible();
    await expect(root).not.toHaveAttribute('data-uploading');
    const frame = await frameOf(root);
    await expect(frame.locator('[data-br-upload]')).toHaveCount(0);
    expect(await frame.locator('img').count()).toBe(
      (fixture('01-nested-layout').match(/<img/g) ?? []).length,
    );
    expect(await draftOf(page, 'content')).toBe(fixture('01-nested-layout'));
    await expect(dirty(page)).toHaveText('無未儲存變更');
  });

  test('rich-text images disabled: pasted image refused with a message', async ({ page }) => {
    await openDemo(page);
    const root = summary(page);
    await (await frameOf(root)).locator('body').click();
    await paste(root, { files: [{ name: 'no.png', type: 'image/png' }] });
    await expect(page.getByText('這個欄位不能貼上或拖放圖片檔。').first()).toBeVisible();
    expect(await draftOf(page, 'summary')).toBe('<p><br></p>');
    expect(await (await frameOf(root)).locator('img, [data-br-upload]').count()).toBe(0);
    await expect(page.getByTestId('request-count')).toContainText('上傳：0');
  });

  test('rich-text drop: image uploads at the drop point in a repeater row; a PDF is refused', async ({
    page,
  }) => {
    await openDemo(page);
    const root = section(page, 1);
    const before = String(await draftOf(page, 'sections.0.body'));
    const pdf = await drop(root, 'strong', { name: 'doc.pdf', type: 'application/pdf' });
    expect(pdf).toEqual({ over: true, drop: true });
    await expect(page.getByText(/不支援這種檔案格式/).first()).toBeVisible();
    expect(page.url()).toContain(DEMO.slice(1));
    expect(await draftOf(page, 'sections.0.body')).toBe(before);

    await drop(root, 'strong', { name: 'drop.png', type: 'image/png' });
    await expect.poll(() => draftOf(page, 'sections.0.body')).toContain(`${UPLOADED}1`);
    const body = String(await draftOf(page, 'sections.0.body'));
    // Inside the paragraph that was dropped on, which is still the only block.
    expect(body).toMatch(/^<p class="font_lv5">[\s\S]*<img src="[^"]+" alt="drop">[\s\S]*<\/p>$/);
    expect(body.match(/<p/g)).toHaveLength(1);
  });

  test('rich-text remount during an upload clears the uploading state', async ({ page }) => {
    await openDemo(page);
    await (await frameOf(summary(page))).locator('body').click();
    await page.keyboard.type('簡短');
    await page.getByLabel(/慢速請求/).check();
    await caretAtFirstText(page, content(page), 'h2');
    await paste(content(page), { files: [{ name: 'gone.png', type: 'image/png' }] });
    await expect(content(page)).toHaveAttribute('data-uploading', '1');
    await page.getByRole('button', { name: '重新掛載表單', exact: true }).click();
    await editorReady(content(page));
    await expect(page.getByTestId('request-count')).toContainText('取消：1');
    await page.waitForTimeout(1600);
    await expect(content(page)).not.toHaveAttribute('data-uploading');
    expect(await draftOf(page, 'content')).not.toContain('<img src="/demo/rich-text/uploaded');
    await page.getByLabel(/慢速請求/).uncheck();
    await save(page);
    await expect(page.getByTestId('form-saved')).toContainText('簡短');
  });
});

test.describe('rich-text keyboard, read-only view and dialog', () => {
  test('rich-text Tab leaves the editor from a list item and from a table cell', async ({
    page,
  }) => {
    await openDemo(page);
    const root = content(page);
    for (const [name, selector] of [
      ['10-lists', 'ol li'],
      ['06-table-spec', 'td'],
    ] as const) {
      await loadFixture(page, name);
      await caretAtFirstText(page, root, selector);
      await page.keyboard.press('Tab');
      // Focus moves on (to the next control, or into the next editor), never stays in this one.
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.getAttribute('title')))
        .not.toBe('商品介紹');
      expect(await draftOf(page, 'content')).toBe(fixture(name));
    }
  });

  test('rich-text read-only view: sandboxed, auto height, links open in a new tab', async ({
    page,
  }) => {
    await openDemo(page);
    const view = page.getByTitle('已發布內容（唯讀）');
    await expect(view).toHaveAttribute('sandbox', /allow-same-origin/);
    const sandbox = (await view.getAttribute('sandbox')) ?? '';
    for (const token of ['allow-scripts', 'allow-forms', 'allow-top-navigation'])
      expect(sandbox).not.toContain(token);
    await expect
      .poll(() =>
        view.evaluate((f: HTMLIFrameElement) => {
          const doc = f.contentDocument?.documentElement;
          return doc
            ? Math.abs(f.getBoundingClientRect().height - Math.min(doc.scrollHeight, 500))
            : 99;
        }),
      )
      .toBeLessThanOrEqual(2);
    expect((await view.boundingBox())?.height ?? 0).toBeGreaterThan(150);
    const frame = await (await view.elementHandle())?.contentFrame();
    if (!frame) throw new Error('no view frame');
    expect(await frame.evaluate(() => document.querySelector('base')?.getAttribute('target'))).toBe(
      '_blank',
    );
    expect(
      await frame.evaluate(() =>
        [...document.querySelectorAll('a[href]')].every(
          (a) => a.getAttribute('rel') === 'noopener noreferrer',
        ),
      ),
    ).toBe(true);
    const opened = page.waitForEvent('popup');
    await frame.getByText('看全部商品').click();
    const tab = await opened;
    expect(tab.url()).toContain('/demo/shop/all');
    await tab.close();
    expect(page.url()).toContain(DEMO.slice(1));
    await expect(page.locator('.jodit-container')).toHaveCount(5); // the view loads no editor
  });

  test('rich-text link popup inside a form dialog sits by its button and works', async ({
    page,
  }) => {
    await openDemo(page);
    await page.getByRole('button', { name: '在彈窗中編輯', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '在彈窗中編輯' });
    const root = dialog.locator('.br-rich-text');
    await editorReady(root);
    await selectAllIn(page, root);
    await button(root, 'link').click();
    const pop = dialog.locator('.jodit-popup');
    await expect(pop).toBeVisible();
    const b = await root.locator('.jodit-toolbar-button_link').boundingBox();
    const p = await pop.boundingBox();
    if (!b || !p) throw new Error('missing boxes');
    expect(Math.abs(p.y - (b.y + b.height))).toBeLessThan(24);
    expect(Math.abs(p.x - b.x)).toBeLessThan(320);
    await pop.locator('input[name="url"]').fill('https://shop.example/dialog');
    await pop.locator('.jodit-ui-button_variant_primary, button[type="submit"]').first().click();
    await expect(dialog).toBeVisible();
    await expect(
      (await frameOf(root)).locator('a[href="https://shop.example/dialog"]').first(),
    ).toBeVisible();
    await dialog.getByRole('button', { name: '儲存', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('form-wire')).toContainText('https://shop.example/dialog');
  });

  test('rich-text demo page has no axe violations', async ({ page }) => {
    await openDemo(page);
    await animationsIdle(page);
    // The read-only view is a sandboxed iframe without allow-scripts: axe cannot run inside it (and
    // trying logs "Blocked script execution"), so its content is excluded; the iframe element itself
    // (title, describedby) is still checked. The editing iframes are analysed, content included.
    const { violations } = await new AxeBuilder({ page }).exclude('iframe[sandbox]').analyze();
    // Every impact, as in a11y.spec.ts (a minor aria-allowed-role on the editing body once slipped
    // through a serious/critical-only filter).
    expect(
      violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target.join(' ')),
      })),
    ).toEqual([]);
  });
});

/**
 * Jodit's clean-html walker runs over the whole document after an edit, in idle slices
 * (`cleanHTML.timeout`, 300 ms in jodit/esm/plugins/clean-html/config.js), and reports what it changed
 * only as an internal change. Wait past that window, then leave the editor (the blur reports the
 * current document) so the form value shows whatever the cleaner did.
 */
async function settleCleaning(page: Page) {
  await page.waitForTimeout(1200);
  await page.getByRole('heading', { name: '表單欄位', exact: true }).click();
  await page.waitForTimeout(100);
}

test.describe('rich-text edits next to legacy markup keep it', () => {
  test('rich-text typing inside <b> and <i> keeps them (no b→strong, i→em)', async ({ page }) => {
    await openDemo(page);
    await loadFixture(page, '03-spacers-breaks');
    const root = content(page);
    await caretAtFirstText(page, root, 'b', 1);
    await page.keyboard.type('Q');
    await caretAtFirstText(page, root, 'i', 1);
    await page.keyboard.type('R');
    await settleCleaning(page);
    const value = String(await draftOf(page, 'content'));
    expect(value).toContain('<b>均Q勻推開</b>');
    expect(value).toContain('<i>人R工色素</i>');
    for (const tag of ['<b>', '<i>', '<strong>', '<em>'])
      expect(value.split(tag).length, tag).toBe(fixture('03-spacers-breaks').split(tag).length);
    // The paragraph typed into sits right after a <p>&nbsp;</p> spacer: the spacers stay.
    expect(value.startsWith('<p>&nbsp;</p>\n<p class="font_lv4">')).toBe(true);
    expect(NBSP_COUNT(value)).toBe(NBSP_COUNT(fixture('03-spacers-breaks')));
  });

  test('rich-text typing next to empty decorative elements keeps them and the spacer', async ({
    page,
  }) => {
    await openDemo(page);
    await loadFixture(page, '12-positioned-banner');
    const root = content(page);
    await caretAtFirstText(page, root, 'span.tagBadge[style]', 1);
    await page.keyboard.type('Q');
    await settleCleaning(page);
    const value = String(await draftOf(page, 'content'));
    expect(value).toContain('早Q鳥');
    expect(value).toContain(
      '<div style="position: absolute; top: 0; right: 0; width: 120px; height: 120px; border-radius: 0 0 0 120px; background-color: rgba(255, 255, 255, 0.4); z-index: 1;"></div>',
    );
    // An empty inline element (a CSS dot): what Jodit's removeEmptyElements would delete.
    expect(value).toContain(
      '<span class="tagDot" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #b5452f;"></span><span class="tagBadge">限量</span>',
    );
    expect(value.endsWith('<p>&nbsp;</p>\n')).toBe(true);
  });

  test('rich-text typing next to a YouTube embed leaves the iframe as it was', async ({ page }) => {
    await openDemo(page);
    await loadFixture(page, '08-youtube-embed');
    const root = content(page);
    await caretAtFirstText(page, root, 'p.font_lv6', 1);
    await page.keyboard.type('Q');
    await settleCleaning(page);
    const value = String(await draftOf(page, 'content'));
    expect(value).toContain('影Q片約兩分鐘');
    expect(value).toContain(
      '<iframe src="https://www.youtube.com/embed/demoVideo01" width="560" height="314" allowfullscreen="allowfullscreen"></iframe>',
    );
    expect(value).not.toContain('sandbox');
  });

  test('rich-text typing inside a target=_blank link adds no rel', async ({ page }) => {
    await openDemo(page);
    await loadFixture(page, '04-link-blocks');
    const root = content(page);
    await caretAtFirstText(page, root, 'a[target="_blank"]:not([rel])', 1);
    await page.keyboard.type('Q');
    await settleCleaning(page);
    const value = String(await draftOf(page, 'content'));
    expect(value).toContain('<a href="/demo/shop/all" target="_blank">看Q全部商品</a>');
    expect(value.split('rel="noopener"').length).toBe(
      fixture('04-link-blocks').split('rel="noopener"').length,
    );
    expect(value).not.toContain('noreferrer');
  });
});

test.describe('rich-text disabled, aria and keyboard', () => {
  test('rich-text disabled editor cannot be edited and its toolbar is inert', async ({ page }) => {
    await openDemo(page);
    const root = editor(page, '停用的內容');
    const frame = await frameOf(root);
    const before = await draftOf(page, 'archived');
    expect(before).toBe('<p class="font_lv5">停用時只能閱讀，不能修改。</p>');
    await expect(frame.locator('body')).toHaveAttribute('aria-disabled', 'true');
    await expect(frame.locator('body')).not.toHaveAttribute('contenteditable', 'true');
    await frame.locator('p').click({ force: true });
    await page.keyboard.type('不該出現');
    await button(root, 'bold').click({ force: true });
    await page.waitForTimeout(400);
    expect(await frame.evaluate(() => document.body.innerHTML)).toBe(String(before));
    expect(await draftOf(page, 'archived')).toBe(before);
    await expect(dirty(page)).toHaveText('無未儲存變更');
    for (const name of ['bold', 'link', 'table', 'source'])
      await expect(button(root, name)).toBeDisabled();
  });

  test('rich-text editing iframes carry label, required, invalid and error description', async ({
    page,
  }) => {
    await openDemo(page);
    const labelOf = (root: Locator) =>
      root.locator('iframe.jodit-wysiwyg_iframe').evaluate((f) =>
        (f.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' '),
      );
    // The editable <body> may carry no role/aria-label/aria-required (axe): the iframe is named by the
    // field caption, plus 「必填」 when required, and the body is the browser's editable document.
    expect(await labelOf(content(page))).toContain('商品介紹');
    expect(await labelOf(content(page))).not.toContain('必填');
    expect(await labelOf(summary(page))).toMatch(/簡短說明[\s\S]*必填/);
    const frameEl = summary(page).locator('iframe.jodit-wysiwyg_iframe');
    await expect(frameEl).toHaveAccessibleName(/簡短說明.*必填/);
    await expect(content(page).locator('iframe.jodit-wysiwyg_iframe')).toHaveAccessibleName(
      '商品介紹',
    );
    const body = (await frameOf(summary(page))).locator('body');
    await expect(body).toHaveAttribute('contenteditable', 'true');
    for (const attr of ['role', 'aria-label', 'aria-required', 'aria-multiline'])
      await expect(body).not.toHaveAttribute(attr, /.*/);
    await expect(body).not.toHaveAttribute('aria-invalid', 'true');
    await expect(frameEl).not.toHaveAttribute('aria-invalid', 'true');
    await save(page);
    await expect(body).toHaveAttribute('aria-invalid', 'true');
    await expect(frameEl).toHaveAttribute('aria-invalid', 'true');
    await expect(frameEl).toHaveAccessibleDescription(/請填寫簡短說明。/);
    const described = await summary(page)
      .locator('iframe.jodit-wysiwyg_iframe')
      .evaluate((f) =>
        (f.getAttribute('aria-describedby') ?? '')
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' '),
      );
    expect(described).toContain('請填寫簡短說明。');
  });

  test('rich-text Tab enters the editing area in one stop and Shift+Tab goes back', async ({
    page,
  }) => {
    await openDemo(page);
    const failure = page.getByLabel('模擬上傳失敗');
    await failure.focus();
    await page.keyboard.press('Tab');
    const active = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLIFrameElement | null;
        const inner = el?.tagName === 'IFRAME' ? el.contentDocument?.activeElement : null;
        return `${el?.tagName}:${el?.getAttribute('title') ?? el?.textContent?.slice(0, 20)}>${inner?.tagName ?? ''}`;
      });
    // The toolbar buttons are not tab stops (Jodit), so the next stop is the editing body itself:
    // one stop per editor (not the iframe and then its body).
    await expect.poll(active).toBe('IFRAME:商品介紹>BODY');
    await page.keyboard.press('Shift+Tab');
    await expect(failure).toBeFocused();
    await page.keyboard.press('Tab');
    await expect.poll(active).toBe('IFRAME:商品介紹>BODY');
    await page.keyboard.press('Tab');
    await expect.poll(active).toBe('IFRAME:簡短說明>BODY');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(active).toBe('IFRAME:商品介紹>BODY');
  });

  test('rich-text Meta+Enter inside the editor saves a form page with the typed text', async ({
    page,
  }) => {
    await openDemo(page);
    await page.getByRole('button', { name: '表單頁版本', exact: true }).click();
    const host = page.getByTestId('rich-text-form-page');
    const root = host.locator('.br-rich-text');
    await editorReady(root);
    await caretAtFirstText(page, root, 'p');
    await page.keyboard.type('快捷鍵儲存');
    await page.keyboard.press('Meta+Enter');
    await expect(page.getByTestId('form-wire')).toContainText('快捷鍵儲存');
    // The shortcut saved; it did not insert a line break into the document. (Read the saved content,
    // not the iframe: saving may remount the form page.)
    const wire = JSON.parse((await page.getByTestId('form-wire').textContent()) ?? '{}');
    expect(String(wire.content).match(/<p[ >]/g)).toHaveLength(2);
  });

  test('rich-text Control+Enter inside the editor saves a form dialog with the typed text', async ({
    page,
  }) => {
    await openDemo(page);
    await page.getByRole('button', { name: '在彈窗中編輯', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '在彈窗中編輯' });
    const root = dialog.locator('.br-rich-text');
    await editorReady(root);
    await caretAtFirstText(page, root, 'p');
    await page.keyboard.type('彈窗快捷鍵');
    await page.keyboard.press('Control+Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('form-wire')).toContainText('彈窗快捷鍵');
  });
});

// Linux baselines are generated in CI (snapshot-filter "rich-text").
for (const scheme of SCHEMES) {
  for (const width of [1440, 390]) {
    test.describe(`rich-text screenshots ${scheme} ${width}px`, () => {
      test.use({ viewport: { width, height: 900 } });
      test(`rich-text editor, source mode and read-only view (${scheme}, ${width})`, async ({
        page,
      }) => {
        await openDemo(page, scheme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const root = content(page);
        // Toolbar wraps cleanly: every button inside the shell, the document keeps usable height.
        const fit = await root.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const buttons = [...el.querySelectorAll('.jodit-toolbar-button')].map((b) =>
            b.getBoundingClientRect(),
          );
          return {
            inside: buttons.every((b) => b.left >= box.left - 1 && b.right <= box.right + 1),
            work: el.querySelector('.jodit-workplace')?.getBoundingClientRect().height ?? 0,
          };
        });
        expect(fit.inside).toBe(true);
        expect(fit.work).toBeGreaterThan(300);
        await (await frameOf(root)).evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          getSelection()?.removeAllRanges();
        });
        await animationsIdle(page);
        await expect(root).toHaveScreenshot(`rich-text-editor-${scheme}-${width}.png`);
        await button(root, 'source').click();
        await expect(root.locator('textarea.jodit-source__mirror')).toBeVisible();
        await root.locator('textarea.jodit-source__mirror').evaluate((t: HTMLTextAreaElement) => {
          t.blur();
          t.scrollTop = 0;
        });
        await expect(root).toHaveScreenshot(`rich-text-source-${scheme}-${width}.png`);
        await button(root, 'source').click();
        const view = page.getByTitle('已發布內容（唯讀）');
        await view.scrollIntoViewIfNeeded();
        await expect(view).toHaveScreenshot(`rich-text-view-${scheme}-${width}.png`);
      });
    });
  }
}
for (const width of [1440, 390]) {
  test.describe(`rich-text link popup dark ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test(`rich-text dark link popup (${width})`, async ({ page }) => {
      await openDemo(page, 'dark');
      const root = summary(page);
      await (await frameOf(root)).locator('body').click();
      await page.keyboard.type('連結文字');
      await selectAllIn(page, root);
      await button(root, 'link').click();
      const pop = popup(page);
      await expect(pop).toBeVisible();
      await expect(pop).toHaveClass(/jodit_theme_brume/);
      await animationsIdle(page);
      await expect(pop).toHaveScreenshot(`rich-text-link-popup-dark-${width}.png`);
    });
  });
}
