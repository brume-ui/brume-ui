import { describe, expect, it } from 'vitest';
import { buildJoditConfig, type JoditConfigOptions } from './jodit-config';

const base: JoditConfigOptions = {
  height: 400,
  language: 'zh_tw',
  dark: false,
  readOnly: false,
  disabled: false,
  contentCss: ['/a.css', '/b.css'],
  imagesEnabled: true,
  blockLabels: { p: 'Paragraph', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' },
};
const cfg = (o: Partial<JoditConfigOptions> = {}) => buildJoditConfig({ ...base, ...o });

describe('buildJoditConfig', () => {
  it('keeps every content-rewriting cleanHTML option off', () => {
    const c = cfg().cleanHTML as Record<string, unknown>;
    expect(c).toEqual({
      removeEmptyElements: false,
      fillEmptyParagraph: false,
      replaceNBSP: false,
      replaceOldTags: false,
      denyTags: 'script',
      sandboxIframesInContent: false,
      safeLinksTarget: false,
      useIframeSandbox: false,
      convertUnsafeEmbeds: false,
      removeEventAttributes: true,
      safeJavaScriptLink: true,
    });
  });

  it.each([
    ['removeEmptyElements'],
    ['fillEmptyParagraph'],
    ['replaceNBSP'],
    ['replaceOldTags'],
    ['sandboxIframesInContent'],
    ['safeLinksTarget'],
    ['useIframeSandbox'],
    ['convertUnsafeEmbeds'],
  ])('cleanHTML.%s is false', (k) => {
    expect((cfg().cleanHTML as Record<string, unknown>)[k]).toBe(false);
  });

  it('denies only script (iframes survive) and keeps the security options', () => {
    const c = cfg().cleanHTML as Record<string, unknown>;
    expect(c.denyTags).toBe('script');
    expect(c.removeEventAttributes).toBe(true);
    expect(c.safeJavaScriptLink).toBe(true);
  });

  it('has no paste dialogs and inserts pasted HTML as is', () => {
    const c = cfg();
    expect(c.askBeforePasteHTML).toBe(false);
    expect(c.askBeforePasteFromWord).toBe(false);
    expect(c.processPasteFromWord).toBe(false);
    expect(c.defaultActionOnPaste).toBe('insert_as_html');
  });

  it('disables paste-storage and other optional plugins', () => {
    const d = cfg().disablePlugins as string[];
    expect(d).toContain('paste-storage');
    expect(d).toEqual(
      expect.arrayContaining([
        'ai-assistant',
        'speech-recognize',
        'powered-by-jodit',
        'about',
        'print',
        'preview',
        'spellcheck',
        'stat',
      ]),
    );
  });

  it('makes no network calls and no upload', () => {
    const c = cfg();
    expect(c.sourceEditor).toBe('area');
    expect(c.beautifyHTML).toBe(false);
    expect(c.hidePoweredByJodit).toBe(true);
    expect(c.editHTMLDocumentMode).toBeUndefined();
    expect(c.filebrowser).toBeUndefined();
    expect((c.uploader as { url?: string } | undefined)?.url ?? '').toBe('');
  });

  it('uses an iframe with the content css', () => {
    const c = cfg();
    expect(c.iframe).toBe(true);
    expect(c.iframeCSSLinks).toEqual(['/a.css', '/b.css']);
  });

  it('maps layout options', () => {
    const c = cfg({ height: 321, language: 'en', dark: true, placeholder: 'Write' });
    expect(c.height).toBe(321);
    expect(c.language).toBe('en');
    expect(c.theme).toBe('dark');
    expect(c.placeholder).toBe('Write');
    expect(c.toolbarSticky).toBe(false);
    expect(c.statusbar).toBe(false);
    expect(cfg().theme).toBe('default');
    expect(cfg({ language: 'zh_tw' }).language).toBe('zh_tw');
  });

  it('maps readOnly / disabled', () => {
    expect(cfg().readonly).toBe(false);
    expect(cfg({ readOnly: true }).readonly).toBe(true);
    expect(cfg({ disabled: true }).disabled).toBe(true);
    expect(cfg().disabled).toBe(false);
  });

  it('has the fixed button list (outdent/indent after the lists: ruling R-8)', () => {
    expect(cfg().buttons).toEqual([
      'undo',
      'redo',
      '|',
      'paragraph',
      '|',
      'bold',
      'italic',
      'underline',
      'strikethrough',
      '|',
      'brush',
      '|',
      'left',
      'center',
      'right',
      '|',
      'ul',
      'ol',
      'outdent',
      'indent',
      '|',
      'link',
      'image',
      'table',
      'video',
      'hr',
      '|',
      'eraser',
      '|',
      'source',
    ]);
  });

  it('paragraph menu: p and h1-h3, labelled with the given (translated) labels', () => {
    expect((cfg().controls as Record<string, { list?: unknown }>).paragraph?.list).toEqual({
      p: 'Paragraph',
      h1: 'Heading 1',
      h2: 'Heading 2',
      h3: 'Heading 3',
    });
    const zh = cfg({ blockLabels: { p: '内文', h1: '标题 1', h2: '标题 2', h3: '标题 3' } });
    expect((zh.controls as Record<string, { list?: unknown }>).paragraph?.list).toEqual({
      p: '内文',
      h1: '标题 1',
      h2: '标题 2',
      h3: '标题 3',
    });
  });

  it('link popup: no nofollow checkbox and no class name field (R-8)', () => {
    expect(cfg().link).toEqual({ noFollowCheckbox: false, modeClassName: false });
  });

  it('keeps the image button whether or not images are enabled (P-1) and does not leak imagesEnabled', () => {
    for (const imagesEnabled of [true, false]) {
      const c = cfg({ imagesEnabled });
      expect(c.buttons).toContain('image');
      expect('imagesEnabled' in c).toBe(false);
    }
  });

  it('is pure: equal input, equal output, no shared references', () => {
    const a = cfg();
    const b = cfg();
    expect(a).toEqual(b);
    expect(a.cleanHTML).not.toBe(b.cleanHTML);
    expect(a.disablePlugins).not.toBe(b.disablePlugins);
  });
});
