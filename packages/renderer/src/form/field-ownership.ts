import type { RowContext } from '@brume-ui/brume-schema';
import { rowLifetime } from './row-lifetime';
import type { FormApi } from './use-form-state';

/** Only explicit stable row identity may replace the current numeric path as a mounted key. */
export function fieldOwnershipKey(form: FormApi, path: string, rowContext?: RowContext): string {
  const field = form.getField(path);
  const context = rowContext ?? field?.rowContext;
  return context?.length && field
    ? JSON.stringify([field.templatePath, context, rowLifetime(form, context)])
    : path;
}
