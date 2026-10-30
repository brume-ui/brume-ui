import type { AfterSave, FormPage } from '@brume-ui/brume-schema';
export const AFTER_SAVE_KEY = (formId: string) => `brume.form.${formId}.after`;
export function readAfterSave(page: FormPage): AfterSave {
  try {
    const stored = localStorage.getItem(AFTER_SAVE_KEY(page.formId));
    if (page.after.options.includes(stored as AfterSave)) return stored as AfterSave;
  } catch {
    /* Storage can be unavailable. */
  }
  return page.after.default;
}
export function writeAfterSave(formId: string, after: AfterSave): void {
  try {
    localStorage.setItem(AFTER_SAVE_KEY(formId), after);
  } catch {
    /* Optional preference. */
  }
}
