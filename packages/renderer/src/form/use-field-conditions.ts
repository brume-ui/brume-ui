import type { FieldDef } from '@brume-ui/brume-schema';
import type { FormApi } from './use-form-state';

/** Uses the same current-value activity snapshot as validation. Pass the explicit enclosing row. */
export function useFieldConditions(
  def: FieldDef,
  form: FormApi,
  rowPath?: string,
): { visible: boolean; enabled: boolean } {
  const field = form.fields.find((entry) => entry.def === def && entry.rowPath === rowPath);
  if (!field) throw new Error(`Field is not present in the current form row: ${def.name}`);
  return { visible: field.visible, enabled: field.enabled };
}
