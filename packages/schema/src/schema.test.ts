import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import {
  ClientRuleSchema,
  DisplaySchema,
  emitJsonSchema,
  FieldDefSchema,
  FilterInputSchema,
  FormNodeSchema,
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

type Literals = { const?: string; anyOf?: { const: string }[] };

/** union 各分支判別欄位（預設 `type`）的所有字面值。 */
function variantTypes(union: unknown, key = 'type'): string[] {
  return (union as { anyOf: unknown[] }).anyOf.flatMap((branch): string[] => {
    // 巢狀的 union（FieldDef 內的 PlainFieldDef）攤平
    if ((branch as { anyOf?: unknown[] }).anyOf) return variantTypes(branch, key);
    const t = (branch as { properties: Record<string, Literals> }).properties[key] as Literals;
    return t.anyOf ? t.anyOf.map((l) => l.const) : [t.const as string];
  });
}

const fixture = (dir: string, name: string): unknown => load(dir).find(([n]) => n === name)?.[1];

type AnyNode = {
  type: string;
  field?: AnyField;
  children?: AnyNode[];
  columns?: { children: AnyNode[] }[];
};
type AnyField = { type: string; rules?: { rule: string }[]; extra?: AnyField[] };

/** 走訪版型樹，收集所有節點、欄位（含 upload.extra）與其所在的 embeds 深度。 */
function walk(nodes: AnyNode[], inEmbeds = false) {
  const out = { nodes: [] as AnyNode[], fields: [] as AnyField[], uploadsInEmbedsWithExtra: 0 };
  const visitField = (f: AnyField, embeds: boolean) => {
    out.fields.push(f);
    if (f.type === 'upload' && embeds && (f.extra?.length ?? 0) > 0) out.uploadsInEmbedsWithExtra++;
    for (const e of f.extra ?? []) visitField(e, embeds);
  };
  const visit = (n: AnyNode, embeds: boolean) => {
    out.nodes.push(n);
    if (n.field) visitField(n.field, embeds);
    const nested = embeds || n.type === 'embeds';
    for (const c of n.children ?? []) visit(c, nested);
    for (const col of n.columns ?? []) for (const c of col.children) visit(c, nested);
  };
  for (const n of nodes) visit(n, inEmbeds);
  return out;
}

type GridFull = {
  page: {
    resource?: { presentation: string };
    quickCreate?: { fields: unknown[] };
    actions: Record<'row' | 'batch' | 'tools', { form?: { fields: unknown[] } }[]>;
    columns: { display?: { type: string }; editor?: { type: string } }[];
    rows: { _meta?: unknown }[];
    filters: { items: { type?: string; input?: { type: string } }[] };
    columnFilters: { input: { type: string } }[];
  };
};

describe('schema 0.4', () => {
  it('is version 0.4.0', () => {
    expect(SCHEMA_VERSION).toBe('0.4.0');
  });

  it('legacy form-full.json keeps covering static and upload field types, node type and client rule, and an upload with extra inside embeds', () => {
    const full = fixture('fixtures/valid', 'form-full.json') as {
      page: { form: { nodes: AnyNode[] } };
    };
    const { nodes, fields, uploadsInEmbedsWithExtra } = walk(full.page.form.nodes);
    const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();
    expect(sorted(nodes.map((n) => n.type))).toEqual(sorted(variantTypes(FormNodeSchema)));
    expect(sorted(fields.map((f) => f.type))).toEqual(
      sorted(
        variantTypes(FieldDefSchema).filter(
          (type) => !['relation', 'repeater', 'custom'].includes(type),
        ),
      ),
    );
    expect(sorted(fields.flatMap((f) => (f.rules ?? []).map((r) => r.rule)))).toEqual(
      sorted(variantTypes(ClientRuleSchema, 'rule')),
    );
    expect(uploadsInEmbedsWithExtra).toBeGreaterThan(0);
  });

  it('accepts a form page envelope', () => {
    expect(validateEnvelope(fixture('fixtures/valid', 'form-horizontal.json'))).toEqual({
      ok: true,
    });
  });

  it('rejects an upload inside upload.extra on both validators', () => {
    const base = fixture('fixtures/valid', 'form-full.json') as {
      page: { form: { nodes: { children: { field: { extra: unknown[] } }[] }[] } };
    };
    const copy = structuredClone(base);
    const images = copy.page.form.nodes[2]?.children[1]?.field;
    images?.extra.push({
      type: 'upload',
      name: 'nested',
      label: '巢狀',
      kind: 'file',
      multiple: false,
      accept: ['application/pdf'],
      maxSize: 1,
    });
    expect(validateEnvelope(copy).ok).toBe(false);
    expect(checkEnvelope(copy)).toBe(false);
  });

  it('rejects a column width outside 1–12 on both validators', () => {
    const base = fixture('fixtures/valid', 'form-full.json') as {
      page: { form: { nodes: { children: { columns?: { width: number }[] }[] }[] } };
    };
    for (const width of [0, 13, 2.5]) {
      const copy = structuredClone(base);
      const columns = copy.page.form.nodes[0]?.children[3]?.columns;
      if (columns?.[0]) columns[0].width = width;
      expect(validateEnvelope(copy).ok, `width=${width}`).toBe(false);
      expect(checkEnvelope(copy), `ajv width=${width}`).toBe(false);
    }
  });

  it('legacy grid-full.json keeps covering displays, built-in editors, basic filters, newline and _meta', () => {
    const full = load('fixtures/valid').find(([n]) => n === 'grid-full.json')?.[1] as GridFull;
    const { columns, rows, filters, columnFilters } = full.page;
    const displays = new Set(columns.flatMap((c) => (c.display ? [c.display.type] : [])));
    const editors = new Set(columns.flatMap((c) => (c.editor ? [c.editor.type] : [])));
    const inputs = new Set(
      [...filters.items, ...columnFilters].flatMap((f) => (f.input ? [f.input.type] : [])),
    );
    expect([...displays].sort()).toEqual(variantTypes(DisplaySchema).sort());
    expect([...editors].sort()).toEqual(
      variantTypes(InlineEditorSchema)
        .filter((type) => type !== 'custom')
        .sort(),
    );
    expect([...inputs].sort()).toEqual(
      variantTypes(FilterInputSchema)
        .filter((type) => !['selectTable', 'multipleSelectTable'].includes(type))
        .sort(),
    );
    expect(filters.items.some((i) => i.type === 'newline')).toBe(true);
    expect(rows.some((r) => r._meta !== undefined)).toBe(true);
    expect(full.page.resource?.presentation).toBe('modal');
    expect(full.page.quickCreate?.fields.length).toBeGreaterThan(0);
    const actions = [
      ...full.page.actions.row,
      ...full.page.actions.batch,
      ...full.page.actions.tools,
    ];
    expect(actions.some((a) => (a.form?.fields.length ?? 0) > 0)).toBe(true);
  });

  it('rejects an upload in an action form or in quick create on both validators', () => {
    const base = fixture('fixtures/valid', 'grid-full.json') as GridFull;
    const upload = {
      type: 'upload',
      name: 'file',
      label: '檔案',
      kind: 'file',
      multiple: false,
      accept: ['text/csv'],
      maxSize: 1024,
    };
    const inAction = structuredClone(base);
    inAction.page.actions.tools.find((a) => a.form)?.form?.fields.push(upload);
    const inQuickCreate = structuredClone(base);
    inQuickCreate.page.quickCreate?.fields.push(upload);
    for (const [name, copy] of [
      ['action form', inAction],
      ['quick create', inQuickCreate],
    ] as const) {
      expect(validateEnvelope(copy).ok, name).toBe(false);
      expect(checkEnvelope(copy), `ajv ${name}`).toBe(false);
    }
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

  it('hoists the recursive form types to $defs and refers to them by #/$defs refs', () => {
    const text = JSON.stringify(v0);
    expect(text.includes('"$ref":"#/$defs/FormNode"')).toBe(true);
    expect(text.includes('"$ref":"#/$defs/FieldDef"')).toBe(true);
    expect(/"\$ref":"(?!#\/\$defs\/)/.test(text)).toBe(false);
  });
});
