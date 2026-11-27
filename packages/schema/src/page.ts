import { type Static, Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { DashboardPageSchema } from './dashboard';
import { ErrorPageSchema } from './error-page';
import { FormPageSchema } from './form/form-page';
import { ListPageSchema } from './list';

export const BrumePageSchema = Type.Union([
  ListPageSchema,
  DashboardPageSchema,
  ErrorPageSchema,
  FormPageSchema,
]);
export type BrumePage = Static<typeof BrumePageSchema>;

export const PageEnvelopeSchema = Type.Object({
  schemaVersion: Type.String(),
  page: BrumePageSchema,
});
export type PageEnvelope = Static<typeof PageEnvelopeSchema>;

const compiled = TypeCompiler.Compile(PageEnvelopeSchema);

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

type SchemaError = { path: string; message: string; errors?: Iterable<SchemaError>[] };

/** 把 union 錯誤展開成最接近的那個分支的具體錯誤（錯誤數最少者）。 */
function flatten(errors: Iterable<SchemaError>): SchemaError[] {
  const out: SchemaError[] = [];
  for (const e of errors) {
    const branches = (e.errors ?? []).map((b) => flatten(b)).filter((b) => b.length > 0);
    if (branches.length === 0) {
      out.push(e);
      continue;
    }
    out.push(...branches.reduce((best, b) => (b.length < best.length ? b : best)));
  }
  return out;
}

/**
 * Rules JSON Schema cannot express, so only this hand-written layer enforces them (v0.json does
 * not): a `tree` field's flat options must start at depth 0, never jump more than +1 below the
 * previous option, and have unique values. Walks every object, so trees nested in repeater
 * rows or relation fields are covered.
 */
export function findTreeOptionErrors(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findTreeOptionErrors(item, `${path}/${i}`));
  }
  if (value === null || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  const errors: string[] = [];
  if (node.type === 'tree' && Array.isArray(node.options)) {
    const seen = new Set<string>();
    let previous = -1;
    node.options.forEach((raw, i) => {
      const option = raw as { value?: unknown; depth?: unknown };
      const at = `${path}/options/${i}`;
      if (typeof option?.depth === 'number') {
        if (option.depth > previous + 1) {
          errors.push(
            `${at}/depth: must be 0 for the first option and at most 1 deeper than the previous option`,
          );
        }
        previous = option.depth;
      }
      if (typeof option?.value === 'string') {
        if (seen.has(option.value)) errors.push(`${at}/value: duplicate tree option value`);
        seen.add(option.value);
      }
    });
  }
  for (const [key, child] of Object.entries(node)) {
    errors.push(...findTreeOptionErrors(child, `${path}/${key}`));
  }
  return errors;
}

export function validateEnvelope(value: unknown): ValidationResult {
  if (compiled.Check(value)) {
    const errors = findTreeOptionErrors(value);
    return errors.length === 0 ? { ok: true } : { ok: false, errors };
  }
  const errors = flatten(compiled.Errors(value)).map(
    (e) => `${e.path === '' ? '/' : e.path}: ${e.message}`,
  );
  return { ok: false, errors };
}
