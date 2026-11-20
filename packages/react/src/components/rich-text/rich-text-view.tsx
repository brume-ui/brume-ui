import { useCallback, useEffect, useRef } from 'react';
import { isSafeHref } from '../../http';
import { useBrume } from '../../provider';
import { isEmptyHtml } from './empty';

export interface RichTextViewProps {
  /** Server-sanitised HTML; null or an empty document shows an em dash. */
  html: string | null;
  /** Site stylesheets, so the document looks as it does on the site. Unsafe URLs are dropped. */
  contentCss?: string[];
  /** The frame grows with its content up to this height, then scrolls. */
  maxHeight?: number;
  /** Accessible name (the frame's title). */
  label: string;
  id?: string;
  'aria-describedby'?: string;
}

/**
 * The sandbox never allows scripts, forms or top navigation. `allow-same-origin` (without
 * `allow-scripts`, so nothing inside can run) lets this component measure the document for auto
 * height and give links `rel="noopener noreferrer"`; `allow-popups(-to-escape-sandbox)` lets those
 * links open in a new tab (`<base target="_blank">`) instead of navigating inside the frame.
 */
export const VIEW_SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';

const DEFAULT_MAX_HEIGHT = 480;

/** Base look of the document (the "paper"); site CSS from contentCss comes after and wins. */
const BASE_STYLE =
  'html{color-scheme:light;background:#fff}' +
  'body{margin:0;padding:12px 16px;font:14px/1.6 system-ui,sans-serif;color:#1f2a37;overflow-wrap:anywhere}' +
  'img,video,iframe{max-width:100%}img{height:auto}' +
  'table{border-collapse:collapse}';

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildViewDocument(html: string, contentCss: readonly string[]): string {
  const links = contentCss
    .filter((href) => href.trim() !== '' && isSafeHref(href))
    .map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}">`)
    .join('');
  return (
    '<!doctype html><html><head><meta charset="utf-8"><base target="_blank">' +
    `<style>${BASE_STYLE}</style>${links}</head><body>${html}</body></html>`
  );
}

/** Read-only rich text in a sandboxed iframe: site CSS applies, nothing leaks in or out, no scripts. */
export function RichTextView({
  html,
  contentCss = [],
  maxHeight = DEFAULT_MAX_HEIGHT,
  label,
  id,
  'aria-describedby': describedBy,
}: RichTextViewProps) {
  const { t } = useBrume();
  const frameRef = useRef<HTMLIFrameElement>(null);

  const measure = useCallback(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc?.documentElement) return;
    const height = Math.ceil(doc.documentElement.scrollHeight);
    if (height > 0) frame.style.height = `${Math.min(height, maxHeight)}px`;
  }, [maxHeight]);

  const onLoad = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    for (const a of doc.querySelectorAll('a[href]')) a.setAttribute('rel', 'noopener noreferrer');
    // Images and site CSS arriving later change the height.
    doc.addEventListener('load', measure, true);
    measure();
  }, [measure]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    let width = frame.clientWidth;
    const observer = new ResizeObserver(() => {
      if (frame.clientWidth === width) return;
      width = frame.clientWidth;
      measure();
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [measure]);

  if (isEmptyHtml(html)) {
    return (
      <p id={id} aria-describedby={describedBy} className="br:text-sm br:text-text-muted">
        <span aria-hidden="true">—</span>
        <span className="br:sr-only">{t('richText.empty')}</span>
      </p>
    );
  }

  return (
    <iframe
      ref={frameRef}
      id={id}
      aria-describedby={describedBy}
      title={label}
      sandbox={VIEW_SANDBOX}
      srcDoc={buildViewDocument(html as string, contentCss)}
      onLoad={onLoad}
      style={{ height: Math.min(120, maxHeight) }}
      className="br:block br:w-full br:rounded-input br:border br:border-border"
    />
  );
}
