/**
 * The lazily loaded half of RichTextEditor: everything that touches Jodit. Only `rich-text-editor.tsx`
 * reaches this module, through a dynamic `import()`, so the bundler emits it (and Jodit, its plugins and
 * its stylesheet) as a separate chunk.
 */
import { Jodit } from 'jodit';
// `jodit` registers only a basic plugin set (bold, color, font, format-block, image, link, lists, table,
// placeholder, redo-undo, iframe, …). The toolbar and behaviours below need these as well.
// Deliberately absent: `tab` and `table-keyboard-navigation` capture Tab inside lists and tables, which
// would trap keyboard users in the editor; without them Tab always moves the focus on.
import 'jodit/esm/plugins/paste/paste.js'; // paste pipeline: beforePaste/processPaste hooks used below
import 'jodit/esm/plugins/clipboard/clipboard.js'; // copy/cut of HTML inside the editor
import 'jodit/esm/plugins/clean-html/clean-html.js'; // the cleanHTML options (event attrs, js: links) + eraser
import 'jodit/esm/plugins/justify/justify.js'; // left / center / right buttons
import 'jodit/esm/plugins/hr/hr.js'; // hr button
import 'jodit/esm/plugins/video/video.js'; // video button (its popup is replaced: YouTube only)
import 'jodit/esm/plugins/source/source.js'; // source button (sourceEditor: 'area', no CDN)
import 'jodit/esm/plugins/select/select.js'; // required by inline-popup and select-cells
import 'jodit/esm/plugins/select-cells/select-cells.js'; // table: select a cell range
import 'jodit/esm/plugins/resize-cells/resize-cells.js'; // table: drag column widths
import 'jodit/esm/plugins/resizer/resizer.js'; // resize images and embeds by their handles
import 'jodit/esm/plugins/image-properties/image-properties.js'; // edit an image's src/alt/size
import 'jodit/esm/plugins/drag-and-drop/drag-and-drop.js'; // move text/HTML by dragging
import 'jodit/esm/plugins/drag-and-drop-element/drag-and-drop-element.js'; // move images by dragging
import 'jodit/esm/plugins/add-new-line/add-new-line.js'; // a line after a table/embed at the end
import 'jodit/esm/plugins/key-arrow-outside/key-arrow-outside.js'; // arrow out of inline formatting
import 'jodit/esm/plugins/indent/indent.js'; // outdent / indent buttons
import 'jodit/es2021/jodit.min.css';
// The list-nesting helper of the `tab` plugin, without the plugin (which would capture the Tab key).
import { Dom } from 'jodit/esm/core/dom/dom.js';
import { Button } from 'jodit/esm/core/ui/button/index.js';
import { UIBlock, UIForm, UIInput } from 'jodit/esm/core/ui/form/index.js';
import linkPopupItems from 'jodit/esm/plugins/inline-popup/config/items/a.js';
import { onTabInsideLi } from 'jodit/esm/plugins/tab/cases/on-tab-inside-li.js';
import { useEffect, useId, useRef, useState } from 'react';
import { whileApplying } from './applying';
import type { JoditEditorProps } from './editor-contract';
import { isEmptyHtml } from './empty';
import { buildJoditConfig } from './jodit-config';
import { processPastedHtml } from './paste-clean';
import { altFromFileName, isSingleImageHtml } from './paste-image';
import { youtubeEmbedUrl } from './youtube';

/** Marks the upload placeholders; they never reach `onChange`. */
const UPLOAD_ATTR = 'data-br-upload';
const PLACEHOLDER_RE = new RegExp(`<span ${UPLOAD_ATTR}="\\d+"[^>]*>[^<]*</span>`, 'g');
const PLACEHOLDER_STYLE =
  'display:inline-block;padding:2px 8px;margin:2px;border-radius:4px;background:#eef2f6;color:#5b6776;font:12px/1.6 system-ui,sans-serif';

/** The editing document is "paper": light, whatever the app's colour scheme (legacy inline colours assume it). */
const PAPER_STYLE =
  'html{color-scheme:light;background:#fff}body{color:#1f2a37;font-family:system-ui,sans-serif;font-size:14px}' +
  'body[aria-disabled="true"]{opacity:.5}';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const filesOf = (dt: DataTransfer | null | undefined): File[] => [...(dt?.files ?? [])];
const carriesFiles = (dt: DataTransfer | null | undefined): boolean =>
  Boolean(dt && [...dt.types].includes('Files'));

/**
 * Strings of the link, image and video popups that Jodit's language packs lack (Jodit shows the key
 * as is, e.g. "URL"; zh_cn also lacks "Alternative text").
 */
const I18N = {
  zh_tw: { URL: '網址' },
  zh_cn: { URL: '网址', 'Alternative text': '替代文字' },
};

const HTML_LANG = { zh_tw: 'zh-TW', zh_cn: 'zh-CN', en: 'en' } as const;

function toOutput(html: string): string | null {
  const value = html.replace(PLACEHOLDER_RE, '');
  return isEmptyHtml(value) ? null : value;
}

let uploadSequence = 0;

export default function JoditEditor(props: JoditEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Jodit | null>(null);
  const latest = useRef(props);
  latest.current = props;
  /** The value (as onChange would report it) that matches the editor's content now. */
  const lastEmitted = useRef<string | null | undefined>(undefined);
  /** True while this component writes the value: Jodit fires `change` synchronously on a set. */
  const applying = useRef(false);
  const [ready, setReady] = useState(false);

  // One instance per mount (StrictMode-safe: the alive flag drops a destructed instance's ready).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let alive = true;
    let j: Jodit | null = null;
    const controllers = new Set<AbortController>();
    /** Upload ids still in flight; any other placeholder (e.g. brought back by undo) is stale. */
    const active = new Set<string>();
    const p = latest.current;

    const emit = () => {
      if (!alive || !j || applying.current) return;
      for (const el of j.editor.querySelectorAll(`[${UPLOAD_ATTR}]`)) {
        if (!active.has(el.getAttribute(UPLOAD_ATTR) ?? '')) el.remove();
      }
      const out = toOutput(j.value);
      if (out === lastEmitted.current) return;
      lastEmitted.current = out;
      latest.current.onChange(out);
    };

    const handleFiles = (files: File[], at?: { x: number; y: number }) => {
      const editor = j;
      if (!editor) return;
      const cur = latest.current;
      if (!cur.imagesEnabled) {
        cur.notify(cur.messages.imagesDisabled);
        return;
      }
      if (at) editor.s.insertCursorAtPoint(at.x, at.y);
      for (const file of files) {
        const id = String(++uploadSequence);
        const problem = cur.validateImage(file);
        if (problem) {
          cur.notify(problem);
          continue;
        }
        const placeholder = editor.createInside.element('span');
        placeholder.setAttribute(UPLOAD_ATTR, id);
        placeholder.setAttribute('contenteditable', 'false');
        placeholder.setAttribute('style', PLACEHOLDER_STYLE);
        placeholder.textContent = cur.messages.uploading;
        active.add(id);
        editor.s.insertNode(placeholder, true, false);
        const controller = new AbortController();
        controllers.add(controller);
        cur.onUploadingChange(1);
        const done = (url: string | null, message?: string, name?: string) => {
          controllers.delete(controller);
          active.delete(id);
          if (!alive || controller.signal.aborted) return;
          latest.current.onUploadingChange(-1);
          // Looked up by id: undo/redo may have replaced the node with an equal one.
          const current = editor.editor.querySelector(`[${UPLOAD_ATTR}="${id}"]`);
          if (url && current) {
            const img = editor.createInside.element('img');
            img.setAttribute('src', url);
            img.setAttribute('alt', altFromFileName(name));
            current.replaceWith(img);
          } else if (!url) {
            current?.remove();
            latest.current.notify(message || latest.current.messages.uploadFailed);
          } // else: the placeholder was deleted while uploading, so the image is not wanted

          editor.synchronizeValues();
          emit();
        };
        cur.upload(file, controller.signal).then(
          (result) =>
            result.ok ? done(result.url, undefined, result.name) : done(null, result.message),
          () => done(null),
        );
      }
    };

    const videoControl = {
      tooltip: p.messages.videoTitle,
      popup: (editor: Jodit, _current: unknown, close: () => void) => {
        const input = new UIInput(editor, {
          name: 'url',
          type: 'url',
          required: true,
          label: latest.current.messages.videoUrl,
          placeholder: 'https://www.youtube.com/watch?v=',
        });
        const form = new UIForm(editor, [
          new UIBlock(editor, [input]),
          new UIBlock(editor, [
            Button(editor, '', latest.current.messages.videoInsert, 'primary').onAction(() =>
              form.submit(),
            ),
          ]),
        ]);
        editor.s.save();
        form.onSubmit((data: Record<string, string>) => {
          const src = youtubeEmbedUrl(data.url ?? '');
          if (!src) {
            input.error = latest.current.messages.youtubeOnly;
            return;
          }
          editor.s.restore();
          editor.s.insertHTML(
            `<iframe src="${escapeHtml(src)}" width="560" height="315" allowfullscreen></iframe>`,
          );
          close();
        });
        return form.container;
      },
    };

    const create = () => {
      const area = document.createElement('textarea');
      host.appendChild(area);
      const base = buildJoditConfig({
        height: Math.max(120, p.height - 2), // inside the shell's 1px border
        language: p.language,
        dark: false, // colours come from Brume tokens (rich-text.css), so one theme fits both schemes
        placeholder: p.placeholder,
        readOnly: false,
        disabled: p.disabled,
        contentCss: p.contentCss,
        imagesEnabled: p.imagesEnabled,
        blockLabels: p.messages.blockLabels,
      });
      const controls = base.controls as Record<string, { list?: unknown }>;
      const config = {
        ...base,
        theme: 'brume', // jodit_theme_brume on the editor, its popups and dialogs: rich-text.css styles them
        popupRoot: host.closest<HTMLElement>('[role="dialog"]') ?? undefined,
        iframeTitle: escapeHtml(p.label),
        iframeStyle: `${Jodit.defaultOptions.iframeStyle}${PAPER_STYLE}`,
        i18n: I18N,
        // The popup over a link: open, edit, unlink, colour. Its default also has a `file` button,
        // whose plugin (Jodit's file browser) is not used here.
        popup: { a: Jodit.atom(linkPopupItems.filter((item) => item !== 'file')) },
        // Read by the list-nesting helper and by the outdent button's enabled state (the `tab` plugin's
        // own options; the plugin itself is not loaded).
        tab: { tabInsideLiInsertNewList: true, spaces: 0 },
        // Files dropped on the editor go through our own handler below, never Jodit's uploader.
        enableDragAndDropFileToEditor: false,
        controls: {
          ...controls,
          // Jodit merges option objects deeply: atom() makes the paragraph list replace the default
          // one (which also offers h4, blockquote and pre) instead of being merged into it.
          paragraph: { ...controls.paragraph, list: Jodit.atom(controls.paragraph?.list) },
          video: videoControl,
        },
        events: {
          processPaste: (_e: unknown, html: unknown, types: unknown) =>
            processPastedHtml(html, types, (count) =>
              latest.current.notify(latest.current.messages.imagesDropped(count)),
            ),
          beforePaste: (e: ClipboardEvent) => {
            const dt = e.clipboardData;
            const files = filesOf(dt);
            if (!files.length) return;
            // HTML next to the file (Excel, Word, PowerPoint): paste the HTML, ignore the preview image.
            const html = dt?.getData('text/html') ?? '';
            if (html.trim() !== '' && !isSingleImageHtml(html)) return;
            handleFiles(files);
            return false;
          },
        },
      };
      const editor = Jodit.make(area, config as never);
      j = editor;
      editorRef.current = editor;
      editor.waitForReady().then(() => {
        if (!alive) return;
        // `emit` ignores the change events of the value write below (`applying`).
        editor.e.on('change', emit);
        // Indent / outdent in a list item nest / un-nest it (as the `tab` plugin would), instead of
        // adding a margin to the <li>.
        editor.e.on('beforeCommand', (command: string) => {
          if (command !== 'indent' && command !== 'outdent') return;
          const current = editor.s.current();
          const li = current && Dom.closest(current, 'li', editor.editor);
          if (!li) return; // outside lists: Jodit's own indent (a margin on the block)
          // The helper acts only with the caret at the start of the item.
          editor.s.setCursorIn(li, true);
          if (!onTabInsideLi(editor as never, command === 'outdent')) return;
          editor.synchronizeValues();
          return false;
        });
        // Jodit reports some edits (e.g. a link inserted from its popup) only after a short delay;
        // leaving the editor (e.g. to click Save) reports the current document at once.
        editor.e.on('blur', () => {
          emit();
          latest.current.onBlur?.();
        });
        // Keys typed in the editing iframe never reach the app's document, so its submit shortcut
        // (Meta/Ctrl+Enter on a form page or in a dialog) would do nothing from inside the editor.
        // Capture it before Jodit (which would insert a line break), report the current document,
        // then replay it on the host element in the app's document so the app's handlers run.
        // Escape is left to Jodit: it closes the editor's own popups with it.
        const submitShortcut = (e: KeyboardEvent) => {
          if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.isComposing) return;
          e.preventDefault();
          e.stopPropagation();
          emit();
          host.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              metaKey: e.metaKey,
              ctrlKey: e.ctrlKey,
              shiftKey: e.shiftKey,
              altKey: e.altKey,
              bubbles: true,
              cancelable: true,
            }),
          );
        };
        // Capture phase on the editing document: before Jodit's own handlers on its body. The
        // document goes away with the iframe when the editor is destructed.
        editor.ed.addEventListener('keydown', submitShortcut, true);
        // Any file drag: never the browser default (which would open the file in place of the page).
        editor.e.on(editor.ed, 'dragover', (e: DragEvent) => {
          if (carriesFiles(e.dataTransfer)) e.preventDefault();
        });
        editor.e.on(editor.ed, 'drop', (e: DragEvent) => {
          if (!carriesFiles(e.dataTransfer)) return;
          e.preventDefault();
          e.stopPropagation();
          const files = filesOf(e.dataTransfer);
          if (files.length) handleFiles(files, { x: e.clientX, y: e.clientY });
          return false;
        });
        // The loaded document. Should writing it throw, the editor still reports edits and follows
        // external values (the error itself still surfaces).
        try {
          whileApplying(applying, () => {
            editor.value = latest.current.value ?? '';
          });
        } finally {
          editor.history.clear(); // undo starts at the loaded document, not at an empty editor
          lastEmitted.current = toOutput(editor.value);
          setReady(true);
        }
      });
    };

    // In iframe mode Jodit measures its container while it is created: wait until it is visible
    // (a hidden tab or a closed <details> has no size yet).
    let observer: ResizeObserver | null = null;
    if (host.getClientRects().length > 0 || typeof ResizeObserver === 'undefined') create();
    else {
      observer = new ResizeObserver(() => {
        if (host.getClientRects().length === 0) return;
        observer?.disconnect();
        observer = null;
        if (alive) create();
      });
      observer.observe(host);
    }

    return () => {
      alive = false;
      observer?.disconnect();
      for (const controller of controllers) {
        controller.abort();
        latest.current.onUploadingChange(-1);
      }
      if (j) j.destruct();
      j = null;
      editorRef.current = null;
      host.replaceChildren();
      setReady(false);
    };
  }, []);

  // External value changes are written only when they differ from the editor's content.
  const { value } = props;
  useEffect(() => {
    const j = editorRef.current;
    if (!ready || !j) return;
    if (value === lastEmitted.current) return;
    // '' / <p><br></p> while the editor is already empty: nothing to write.
    if (isEmptyHtml(value) && toOutput(j.value) === null) return;
    const next = value ?? '';
    if (next !== j.value) {
      whileApplying(applying, () => {
        j.value = next;
      });
      j.history.clear(); // a reset or a new record is not undoable into the previous content
    }
    lastEmitted.current = toOutput(j.value);
  }, [value, ready]);

  const { disabled } = props;
  useEffect(() => {
    const j = editorRef.current;
    if (!ready || !j) return;
    j.setDisabled(disabled);
  }, [disabled, ready]);

  // Accessible name and state of the editing area. The editable element is the iframe's <body>, which
  // may carry no role (axe aria-allowed-role), no aria-label (aria-prohibited-attr on a generic
  // element) and no aria-required / aria-multiline (aria-allowed-attr). So: the iframe is named
  // (title, aria-labelledby → the field caption, plus a hidden "必填" when required) and described
  // (aria-describedby → help and error); the contenteditable body is exposed by the browser as an
  // editable, multiline document; aria-invalid / aria-disabled (global) stay on the body, and
  // aria-invalid also on the iframe.
  const { label, labelledBy, describedBy, invalid, required } = props;
  const requiredId = useId();
  useEffect(() => {
    const j = editorRef.current;
    if (!ready || !j) return;
    const requiredText = latest.current.messages.required;
    const frame = j.iframe;
    if (frame) {
      // Jodit gives the iframe tabindex="-1", yet its body is focusable (axe frame-focusable-content);
      // without it the editing area is reached by Tab like any field.
      frame.removeAttribute('tabindex');
      frame.setAttribute('title', required && !labelledBy ? `${label}（${requiredText}）` : label);
      setOrRemove(
        frame,
        'aria-labelledby',
        labelledBy ? (required ? `${labelledBy} ${requiredId}` : labelledBy) : undefined,
      );
      setOrRemove(frame, 'aria-describedby', describedBy);
      setOrRemove(frame, 'aria-invalid', invalid ? 'true' : undefined);
    }
    // Jodit writes its language id (zh_tw) as <html lang>, which is not a valid BCP 47 tag.
    j.ed.documentElement.setAttribute('lang', HTML_LANG[latest.current.language]);
    const body = j.editor;
    setOrRemove(body, 'aria-invalid', invalid ? 'true' : undefined);
    setOrRemove(body, 'aria-disabled', disabled ? 'true' : undefined);
  }, [ready, label, labelledBy, describedBy, invalid, required, disabled, requiredId]);

  return (
    <>
      <div ref={hostRef} className="br:h-full" />
      {required ? (
        <span id={requiredId} hidden>
          {props.messages.required}
        </span>
      ) : null}
    </>
  );
}

function setOrRemove(el: Element, name: string, value: string | undefined) {
  if (value) el.setAttribute(name, value);
  else el.removeAttribute(name);
}
