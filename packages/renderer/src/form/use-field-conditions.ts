import type { Condition, FieldDef } from '@brume-ui/brume-schema';
import { conditionPaths, evaluateCondition, resolveConditionPath } from './conditions';
import type { FormApi } from './use-form-state';

/** Uses the same current-value activity snapshot as validation. Pass the explicit enclosing row. */
export function useFieldConditions(
  def: FieldDef,
  form: FormApi,
  rowPath?: string,
): { visible: boolean; enabled: boolean } {
  const field = form.fields.find(
    (entry) => (entry.def === def || entry.originalDef === def) && entry.rowPath === rowPath,
  );
  if (!field) throw new Error(`Field is not present in the current form row: ${def.name}`);
  return { visible: field.visible, enabled: field.enabled };
}

/**
 * Whether a `group` node shows its children. Same evaluator and same value view as a field's
 * `showWhen` at that position: row-scoped paths resolve against `rowPath` (undefined at the root),
 * values are the effective (stored while inactive) ones, an invalid dependency activates the
 * whole condition, and a dependency whose stored value is not yet known keeps the group shown.
 */
export function groupVisible(condition: Condition, form: FormApi, rowPath?: string): boolean {
  const fields = new Map(form.fields.map((field) => [field.path, field]));
  const paths = conditionPaths(condition).map((path) => resolveConditionPath(path, rowPath));
  if (paths.some((path) => fields.get(path)?.effectiveKnown === false)) return true;
  return evaluateCondition(condition, form.values, rowPath, {
    getField: (path) => fields.get(path)?.def,
    getValue: (path) => form.getEffectiveValue(path),
    isInvalid: (path) => {
      const target = fields.get(path);
      return !!target && target.active && target.validationError !== null;
    },
  });
}
