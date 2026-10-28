import { type BrumeAdapter, toast } from '@brume-ui/brume-react';
import type { Feedback } from '@brume-ui/brume-schema';

/** Starts a file download through a temporary `<a download>` (never through the adapter). */
export function triggerDownload(url: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? '';
  a.rel = 'noopener';
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
}

/**
 * Plays the server's feedback in protocol order: toast, then download; a redirect wins over a
 * refresh, which only happens when asked for.
 */
export function applyFeedback(
  fb: Feedback,
  deps: { adapter: BrumeAdapter; refresh(): void },
): void {
  if (fb.toast) toast[fb.toast.type](fb.toast.message);
  if (fb.download) triggerDownload(fb.download.url, fb.download.filename);
  if (fb.redirect) deps.adapter.visit(fb.redirect);
  else if (fb.refresh) deps.refresh();
}
