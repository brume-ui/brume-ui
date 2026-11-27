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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** The tree rules for one `tree` field declaration. */
function treeOptionErrors(field: Record<string, unknown>, path: string): string[] {
  if (field.type !== 'tree' || !Array.isArray(field.options)) return [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let previous = -1;
  field.options.forEach((raw, i) => {
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
  return errors;
}

function fieldErrors(field: unknown, path: string): string[] {
  if (!isRecord(field)) return [];
  return [
    ...treeOptionErrors(field, path),
    // repeater rows, relation row fields and upload extras hold nested declarations
    ...nodeErrors(field.nodes, `${path}/nodes`),
    ...nodeErrors(field.fields, `${path}/fields`),
    ...list(field.extra).flatMap((item, i) => fieldErrors(item, `${path}/extra/${i}`)),
  ];
}

function nodeErrors(nodes: unknown, path: string): string[] {
  return list(nodes).flatMap((raw, i) => {
    if (!isRecord(raw)) return [];
    const at = `${path}/${i}`;
    return [
      ...(raw.type === 'field' ? fieldErrors(raw.field, `${at}/field`) : []),
      ...nodeErrors(raw.children, `${at}/children`),
      ...list(raw.columns).flatMap((column, c) =>
        isRecord(column) ? nodeErrors(column.children, `${at}/columns/${c}/children`) : [],
      ),
    ];
  });
}

/**
 * Rules JSON Schema cannot express, so only this hand-written layer enforces them (v0.json does
 * not): a `tree` field's flat options must start at depth 0, never jump more than +1 below the
 * previous option, and have unique values. Only declaration positions are walked (form nodes with
 * nested layout nodes, repeater `nodes`, relation `fields`, upload `extra`, action form fields and
 * quick create fields); data rows and form values are never inspected.
 */
export function findTreeOptionErrors(envelope: unknown): string[] {
  const page = isRecord(envelope) ? envelope.page : undefined;
  if (!isRecord(page)) return [];
  if (page.type === 'form')
    return isRecord(page.form) ? nodeErrors(page.form.nodes, '/page/form/nodes') : [];
  const errors: string[] = [];
  const fields = (items: unknown, path: string) =>
    list(items).forEach((item, i) => {
      errors.push(...fieldErrors(item, `${path}/${i}`));
    });
  if (isRecord(page.quickCreate)) fields(page.quickCreate.fields, '/page/quickCreate/fields');
  if (isRecord(page.actions))
    for (const group of ['row', 'batch', 'tools'])
      list(page.actions[group]).forEach((action, i) => {
        if (isRecord(action) && isRecord(action.form))
          fields(action.form.fields, `/page/actions/${group}/${i}/form/fields`);
      });
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
