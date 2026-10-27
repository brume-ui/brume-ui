import { type Static, Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { DashboardPageSchema } from './dashboard';
import { ListPageSchema } from './list';

export const BrumePageSchema = Type.Union([ListPageSchema, DashboardPageSchema]);
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

export function validateEnvelope(value: unknown): ValidationResult {
  if (compiled.Check(value)) return { ok: true };
  const errors = flatten(compiled.Errors(value)).map(
    (e) => `${e.path === '' ? '/' : e.path}: ${e.message}`,
  );
  return { ok: false, errors };
}
