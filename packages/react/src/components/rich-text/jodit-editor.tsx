/**
 * The lazily loaded half of RichTextEditor: everything that touches Jodit. Only `rich-text-editor.tsx`
 * reaches this module, through a dynamic `import()`, so the bundler emits it (and Jodit, its plugins and
 * its stylesheet) as a separate chunk.
 */
import { Jodit } from 'jodit';
// `jodit` registers only a basic plugin set (bold, color, font, format-block, image, link, lists, table,
// placeholder, redo-undo, iframe, …). The toolbar and behaviours below need these as well:
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
import 'jodit/esm/plugins/table-keyboard-navigation/table-keyboard-navigation.js'; // table: arrows/tab
import 'jodit/esm/plugins/resizer/resizer.js'; // resize images and embeds by their handles
import 'jodit/esm/plugins/image-properties/image-properties.js'; // edit an image's src/alt/size
import 'jodit/esm/plugins/drag-and-drop/drag-and-drop.js'; // move text/HTML by dragging
import 'jodit/esm/plugins/drag-and-drop-element/drag-and-drop-element.js'; // move images by dragging
import 'jodit/esm/plugins/add-new-line/add-new-line.js'; // a line after a table/embed at the end
import 'jodit/esm/plugins/tab/tab.js'; // tab indents list items
import 'jodit/esm/plugins/key-arrow-outside/key-arrow-outside.js'; // arrow out of inline formatting
import 'jodit/es2021/jodit.min.css';
import { Button } from 'jodit/esm/core/ui/button/index.js';
import { UIBlock, UIForm, UIInput } from 'jodit/esm/core/ui/form/index.js';
import { useEffect, useRef, useState } from 'react';
import type { JoditEditorProps } from './editor-contract';
import { isEmptyHtml } from './empty';
import { buildJoditConfig } from './jodit-config';
import { cleanPastedHtml } from './paste-clean';
import { youtubeEmbedUrl } from './youtube';

/** Marks the upload placeholders; they never reach `onChange`. */
const UPLOAD_ATTR = 'data-br-upload';
const PLACEHOLDER_RE = new RegExp(`<span ${UPLOAD_ATTR}="\\d+"[^>]*>[^<]*</span>`, 'g');
const PLACEHOLDER_STYLE =
  'display:inline-block;padding:2px 8px;margin:2px;border-radius:4px;background:#eef2f6;color:#5b6776;font:12px/1.6 system-ui,sans-serif';

/** The editing document is "paper": light, whatever the app's colour scheme (legacy inline colours assume it). */
const PAPER_STYLE =
  'html{color-scheme:light;background:#fff}body{color:#1f2a37;font-family:system-ui,sans-serif;font-size:14px}';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const imageFiles = (dt: DataTransfer | null | undefined): File[] =>
  [...(dt?.files ?? [])].filter((f) => f.type.startsWith('image/'));

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
  const [ready, setReady] = useState(false);

  // One instance per mount (StrictMode-safe: the alive flag drops a destructed instance's ready).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let alive = true;
    let j: Jodit | null = null;
    const controllers = new Set<AbortController>();
    const p = latest.current;

    const applyValue = (editor: Jodit, value: string | null) => {
      const next = value ?? '';
      if (next !== editor.value) editor.value = next;
      lastEmitted.current = toOutput(editor.value);
    };

    const emit = () => {
      if (!alive || !j) return;
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
        const problem = cur.validateImage(file);
        if (problem) {
          cur.notify(problem);
          continue;
        }
        const placeholder = editor.createInside.element('span');
        placeholder.setAttribute(UPLOAD_ATTR, String(++uploadSequence));
        placeholder.setAttribute('contenteditable', 'false');
        placeholder.setAttribute('style', PLACEHOLDER_STYLE);
        placeholder.textContent = cur.messages.uploading;
        editor.s.insertNode(placeholder, true, false);
        const controller = new AbortController();
        controllers.add(controller);
        cur.onUploadingChange(1);
        const done = (url: string | null, message?: string) => {
          controllers.delete(controller);
          if (!alive || controller.signal.aborted) return;
          latest.current.onUploadingChange(-1);
          if (url && placeholder.isConnected) {
            const img = editor.createInside.element('img');
            img.setAttribute('src', url);
            img.setAttribute('alt', '');
            placeholder.replaceWith(img);
          } else if (!url) {
            placeholder.remove();
            latest.current.notify(message || latest.current.messages.uploadFailed);
          } // else: the placeholder was deleted while uploading, so the image is not wanted

          editor.synchronizeValues();
          emit();
        };
        cur.upload(file, controller.signal).then(
          (result) => (result.ok ? done(result.url) : done(null, result.message)),
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
      });
      const config = {
        ...base,
        theme: 'brume', // jodit_theme_brume on the editor, its popups and dialogs: rich-text.css styles them
        popupRoot: host.closest<HTMLElement>('[role="dialog"]') ?? undefined,
        iframeTitle: escapeHtml(p.label),
        iframeStyle: `${Jodit.defaultOptions.iframeStyle}${PAPER_STYLE}`,
        controls: { ...(base.controls as Record<string, unknown>), video: videoControl },
        events: {
          processPaste: (_e: unknown, html: unknown, types: unknown) =>
            typeof html === 'string' && /text\/html/.test(String(types ?? ''))
              ? cleanPastedHtml(html)
              : undefined,
          beforePaste: (e: ClipboardEvent) => {
            const files = imageFiles(e.clipboardData);
            if (!files.length) return;
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
        applyValue(editor, latest.current.value);
        editor.e.on('change', emit);
        editor.e.on('blur', () => latest.current.onBlur?.());
        editor.e.on(editor.editor, 'drop', (e: DragEvent) => {
          const files = imageFiles(e.dataTransfer);
          if (!files.length) return;
          e.preventDefault();
          e.stopPropagation();
          handleFiles(files, { x: e.clientX, y: e.clientY });
          return false;
        });
        setReady(true);
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
      for (const controller of controllers) controller.abort();
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
    const next = value ?? '';
    if (next !== j.value) j.value = next;
    lastEmitted.current = toOutput(j.value);
  }, [value, ready]);

  const { disabled } = props;
  useEffect(() => {
    const j = editorRef.current;
    if (!ready || !j) return;
    j.setDisabled(disabled);
  }, [disabled, ready]);

  // Accessible name and state of the editing area. aria-labelledby/-describedby point at ids in this
  // document, so they go on the iframe element; the body inside gets its own label and state.
  const { label, labelledBy, describedBy, invalid, required } = props;
  useEffect(() => {
    const j = editorRef.current;
    if (!ready || !j) return;
    const frame = j.iframe;
    if (frame) {
      frame.setAttribute('title', label);
      setOrRemove(frame, 'aria-labelledby', labelledBy);
      setOrRemove(frame, 'aria-describedby', describedBy);
    }
    const body = j.editor;
    body.setAttribute('role', 'textbox');
    body.setAttribute('aria-multiline', 'true');
    body.setAttribute('aria-label', label);
    setOrRemove(body, 'aria-invalid', invalid ? 'true' : undefined);
    setOrRemove(body, 'aria-required', required ? 'true' : undefined);
    setOrRemove(body, 'aria-disabled', disabled ? 'true' : undefined);
  }, [ready, label, labelledBy, describedBy, invalid, required, disabled]);

  return <div ref={hostRef} className="br:h-full" />;
}

function setOrRemove(el: Element, name: string, value: string | undefined) {
  if (value) el.setAttribute(name, value);
  else el.removeAttribute(name);
}
