import type { FormPage } from '@brume-ui/brume-schema';

/** Envelope refreshes retain identity; record or submission endpoint changes replace the form. */
export function formIdentity(page: FormPage): string {
  return JSON.stringify([
    page.formId,
    page.mode,
    page.record?.id,
    page.submit.method,
    page.submit.url,
  ]);
}
