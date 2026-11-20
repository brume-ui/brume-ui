/// <reference types="vite/client" />
import type { FieldDef, FormDef, FormPage } from '@brume-ui/brume-schema';
import { node } from './form-feature-data';

/**
 * Hand-written imitations of legacy content (designer layout HTML pasted through TinyMCE's source
 * view): no customer content. The same files are the e2e fixtures and, later, the Laravel sanitiser
 * fixtures (one source of truth).
 */
const files = import.meta.glob<string>('../../e2e/fixtures/rich-text/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const TITLES: Record<string, string> = {
  '01-nested-layout': '巢狀版型（預設）',
  '02-product-short': '一句話商品說明',
  '03-spacers-breaks': '空白段落與換行',
  '04-link-blocks': '連結包住區塊',
  '05-accordion': '純 CSS 摺疊問答',
  '06-table-spec': '規格表（合併儲存格）',
  '07-images-gallery': '多張圖片與置中圖',
  '08-youtube-embed': 'YouTube 影片',
  '09-inline-styles': '行內樣式',
  '10-lists': '清單與巢狀清單',
  '11-invalid-css': '拼錯的 CSS 屬性',
  '12-positioned-banner': '絕對定位橫幅',
};

export const RICH_TEXT_FIXTURES: { name: string; title: string; html: string }[] = Object.entries(
  files,
)
  .map(([path, html]) => {
    const name = path.replace(/^.*\/|\.html$/g, '');
    return { name, title: TITLES[name] ?? name, html };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export function richTextFixture(name: string): string {
  const found = RICH_TEXT_FIXTURES.find((fixture) => fixture.name === name);
  if (!found) throw new Error(`Missing rich text fixture ${name}`);
  return found.html;
}

/** The made-up storefront stylesheet that defines the fixtures' classes. */
export const CONTENT_CSS = ['/demo/content.css'];
const images = {
  accept: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  maxSize: 2 * 1024 * 1024,
};

const content: Extract<FieldDef, { type: 'richText' }> = {
  type: 'richText',
  name: 'content',
  label: '商品介紹',
  help: '可貼上或拖放 PNG／JPEG／GIF／WebP 圖片（2 MB 內）。',
  height: 520,
  contentCss: CONTENT_CSS,
  images,
};

export function buildRichTextFixture(): { form: FormDef; values: Record<string, unknown> } {
  return {
    form: {
      layout: 'stacked',
      nodes: [
        node(content),
        node({
          type: 'richText',
          name: 'summary',
          label: '簡短說明',
          help: '必填；這個欄位不開放圖片。',
          placeholder: '用一兩句話介紹商品',
          height: 220,
          required: true,
          rules: [{ rule: 'required', message: '請填寫簡短說明。' }],
        }),
        node({
          type: 'richText',
          name: 'published',
          label: '已發布內容（唯讀）',
          readOnly: true,
          contentCss: CONTENT_CSS,
        }),
        node({
          type: 'repeater',
          name: 'sections',
          label: '補充段落',
          mode: 'json',
          nodes: [
            node({
              type: 'richText',
              name: 'body',
              label: '段落內容',
              height: 260,
              contentCss: CONTENT_CSS,
              images,
            }),
          ],
        }),
      ],
    },
    values: {
      content: richTextFixture('01-nested-layout'),
      // An "empty" document as older editors stored it: required must still fail.
      summary: '<p><br></p>',
      published: richTextFixture('04-link-blocks'),
      sections: [
        {
          _brume: { key: 's1' },
          body: '<p class="font_lv5">第一段：<strong>出貨說明</strong>，付款後三個工作天內出貨。</p>',
        },
        {
          _brume: { key: 's2' },
          body: '<p class="font_lv5">第二段：<em>保存方式</em>，請置於陰涼處。</p>',
        },
      ],
    },
  };
}

/** The same editor inside a form dialog (popup placement inside Brume's Dialog). */
export function buildRichTextDialogPage(): FormPage {
  return {
    type: 'form',
    title: '在彈窗中編輯',
    name: '商品介紹',
    formId: 'form.field.richText.dialog',
    mode: 'edit',
    record: { id: '42' },
    form: { layout: 'stacked', nodes: [node({ ...content, height: 360 })] },
    values: {
      content:
        '<p class="font_lv5">在彈窗裡選取這段文字，再按工具列的「插入連結」。</p><p class="font_lv6 spotDGY">彈出視窗會出現在按鈕旁邊。</p>',
    },
    submit: { method: 'put', url: '/demo/focused/save', label: '儲存' },
    after: { options: ['edit', 'list'], default: 'edit' },
    presentation: 'modal',
    size: 'lg',
    uploadUrl: '/demo/focused/upload',
  };
}
