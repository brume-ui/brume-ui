export interface JoditConfigOptions {
  height: number;
  language: 'zh_tw' | 'zh_cn' | 'en';
  dark: boolean;
  placeholder?: string;
  readOnly: boolean;
  disabled: boolean;
  contentCss: string[];
  /**
   * Whether the editor component accepts pasted/dropped image files (upload). It is deliberately NOT part of the
   * returned Jodit config: the `image` toolbar button is always present (insert by URL, ruling P-1).
   */
  imagesEnabled: boolean;
}

/**
 * Plain Jodit 4 (MIT) options. Legacy HTML must not change by loading, so every option that rewrites content is off.
 * Pure: no Jodit import, no globals, fresh objects on every call.
 */
export function buildJoditConfig(o: JoditConfigOptions): Record<string, unknown> {
  return {
    language: o.language,
    theme: o.dark ? 'dark' : 'default',
    iframe: true, // content CSS applies to the editable document as on the site, and cannot leak into/out of the app
    iframeCSSLinks: [...o.contentCss],
    height: o.height,
    placeholder: o.placeholder ?? '',
    readonly: o.readOnly,
    disabled: o.disabled,
    allowResizeY: false,
    toolbarAdaptive: false,
    toolbarSticky: false,
    statusbar: false,
    showCharsCounter: false,
    showWordsCounter: false,
    hidePoweredByJodit: true,
    useSearch: false,
    spellcheck: false,
    buttons: [
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
    ],
    controls: {
      paragraph: { list: { p: '內文段落', h1: '標題 1', h2: '標題 2', h3: '標題 3' } },
      ul: { list: null }, // plain lists, no list-style-type picker
      ol: { list: null },
    },
    // Each disabled plugin either needs the network / a paid service, or would alter or duplicate content:
    // ai-assistant, speech-recognize: external services. powered-by-jodit, about: branding/info panels.
    // print, preview: open extra windows not needed here. spellcheck: browser-native only.
    // paste-storage: keeps a clipboard history and would re-insert uncleaned HTML. stat: counters unused.
    // (the demo also disabled `mobile`; not needed to preserve content, so it stays enabled.)
    disablePlugins: [
      'ai-assistant',
      'speech-recognize',
      'powered-by-jodit',
      'about',
      'print',
      'preview',
      'spellcheck',
      'paste-storage',
      'stat',
    ],
    sourceEditor: 'area', // the default (ace) loads from a CDN
    beautifyHTML: false, // js-beautify would load from a CDN and reformat the value
    cleanHTML: {
      removeEmptyElements: false,
      fillEmptyParagraph: false,
      replaceNBSP: false,
      replaceOldTags: false,
      denyTags: 'script', // the default also denies iframe, which would delete YouTube embeds
      sandboxIframesInContent: false, // the default adds sandbox="" to every iframe
      safeLinksTarget: false, // the default adds rel="noopener noreferrer" to target=_blank links
      useIframeSandbox: false,
      convertUnsafeEmbeds: false,
      removeEventAttributes: true,
      safeJavaScriptLink: true,
    },
    // paste: our own cleaner (processPaste, wired by the component), no keep/clean dialogs
    askBeforePasteHTML: false,
    askBeforePasteFromWord: false,
    processPasteFromWord: false,
    defaultActionOnPaste: 'insert_as_html',
    link: { noFollowCheckbox: false },
    image: { editSrc: true, useImageEditor: false },
    uploader: { url: '' }, // no Jodit uploader; images go through the component's own upload
  };
}
