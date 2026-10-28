import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import {
  DisplaySchema,
  emitJsonSchema,
  FilterInputSchema,
  InlineEditorSchema,
  SCHEMA_VERSION,
  validateEnvelope,
} from './index';

const pkg = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const load = (dir: string): [string, unknown][] =>
  readdirSync(pkg(dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(readFileSync(pkg(`${dir}/${f}`), 'utf8')) as unknown]);

const v0 = JSON.parse(readFileSync(pkg('schema/v0.json'), 'utf8')) as Record<string, unknown>;
const ajv = new Ajv2020({ strict: true });
const checkEnvelope = ajv.compile(v0);
const checkShared = ajv.compile({ $ref: '#/$defs/SharedProps', $defs: v0.$defs });

/** union 各分支 `type` 欄位的所有字面值。 */
function variantTypes(union: { anyOf: unknown[] }): string[] {
  return union.anyOf.flatMap((branch) => {
    const t = (branch as { properties: { type: { const?: string; anyOf?: { const: string }[] } } })
      .properties.type;
    return t.anyOf ? t.anyOf.map((l) => l.const) : [t.const as string];
  });
}

type GridFull = {
  page: {
    columns: { display?: { type: string }; editor?: { type: string } }[];
    rows: { _meta?: unknown }[];
    filters: { items: { type?: string; input?: { type: string } }[] };
    columnFilters: { input: { type: string } }[];
  };
};

describe('schema 0.2', () => {
  it('is version 0.2.0', () => {
    expect(SCHEMA_VERSION).toBe('0.2.0');
  });

  it('grid-full.json covers every display, editor, filter input, newline and _meta', () => {
    const full = load('fixtures/valid').find(([n]) => n === 'grid-full.json')?.[1] as GridFull;
    const { columns, rows, filters, columnFilters } = full.page;
    const displays = new Set(columns.flatMap((c) => (c.display ? [c.display.type] : [])));
    const editors = new Set(columns.flatMap((c) => (c.editor ? [c.editor.type] : [])));
    const inputs = new Set(
      [...filters.items, ...columnFilters].flatMap((f) => (f.input ? [f.input.type] : [])),
    );
    expect([...displays].sort()).toEqual(variantTypes(DisplaySchema).sort());
    expect([...editors].sort()).toEqual(variantTypes(InlineEditorSchema).sort());
    expect([...inputs].sort()).toEqual(variantTypes(FilterInputSchema).sort());
    expect(filters.items.some((i) => i.type === 'newline')).toBe(true);
    expect(rows.some((r) => r._meta !== undefined)).toBe(true);
  });
});

describe('validateEnvelope (TypeBox)', () => {
  it('has fixtures to check', () => {
    expect(load('fixtures/valid').length).toBeGreaterThanOrEqual(2);
    expect(load('fixtures/invalid').length).toBeGreaterThanOrEqual(4);
  });

  it.each(load('fixtures/valid'))('accepts valid fixture %s', (_n: string, value: unknown) => {
    expect(validateEnvelope(value)).toEqual({ ok: true });
  });

  it.each(load('fixtures/invalid'))(
    'rejects invalid fixture %s with readable errors',
    (_n: string, value: unknown) => {
      const r = validateEnvelope(value);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.length).toBeGreaterThan(0);
        for (const e of r.errors) expect(e).toMatch(/^\/.*: .+/);
      }
    },
  );

  it('reports the path of the offending field', () => {
    const bad = load('fixtures/invalid').find(([n]) => n === 'pagination-page-string.json')?.[1];
    const r = validateEnvelope(bad);
    expect(r.ok === false && r.errors.some((e) => e.includes('/page/pagination/page'))).toBe(true);
  });

  it('rejects out-of-range pagination numbers', () => {
    const base = load('fixtures/valid').find(([n]) => n === 'list-page.json')?.[1] as {
      page: { pagination: Record<string, number> };
    };
    for (const [k, v] of [
      ['page', 0],
      ['perPage', 0],
      ['lastPage', 0],
      ['total', -1],
    ] as const) {
      const copy = structuredClone(base);
      copy.page.pagination[k] = v;
      expect(validateEnvelope(copy).ok, `${k}=${v}`).toBe(false);
      expect(checkEnvelope(copy), `ajv ${k}=${v}`).toBe(false);
    }
  });
});

describe('v0.json against a standard validator (ajv 2020-12)', () => {
  it('declares draft 2020-12 and uses only #/$defs refs', () => {
    expect(v0.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    const refs = [...JSON.stringify(v0).matchAll(/"\$ref":"([^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(r).toMatch(/^#\/\$defs\//);
    expect(JSON.stringify(v0)).not.toContain('"$id"');
  });

  it.each(load('fixtures/valid'))('accepts valid fixture %s', (_n: string, value: unknown) => {
    expect(checkEnvelope(value), JSON.stringify(checkEnvelope.errors)).toBe(true);
  });

  it.each(load('fixtures/invalid'))('rejects invalid fixture %s', (_n: string, value: unknown) => {
    expect(checkEnvelope(value)).toBe(false);
  });

  it.each(load('fixtures/valid-shared'))('SharedProps accepts %s', (_n: string, value: unknown) => {
    expect(checkShared(value), JSON.stringify(checkShared.errors)).toBe(true);
  });

  it.each(load('fixtures/invalid-shared'))(
    'SharedProps rejects %s',
    (_n: string, value: unknown) => {
      expect(checkShared(value)).toBe(false);
    },
  );
});

describe('v0.json', () => {
  it('equals emitJsonSchema() output (rebuild with `pnpm emit-schema`)', () => {
    expect(readFileSync(pkg('schema/v0.json'), 'utf8')).toBe(emitJsonSchema());
  });

  it('roots at PageEnvelope and starts $defs with the page defs', () => {
    expect(v0.$ref).toBe('#/$defs/PageEnvelope');
    expect(Object.keys(v0.$defs as object).slice(0, 3)).toEqual([
      'PageEnvelope',
      'SharedProps',
      'MenuItem',
    ]);
  });
});
