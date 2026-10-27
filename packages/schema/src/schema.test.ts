import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { emitJsonSchema, validateEnvelope } from './index';

const pkg = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const load = (dir: string): [string, unknown][] =>
  readdirSync(pkg(dir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(readFileSync(pkg(`${dir}/${f}`), 'utf8')) as unknown]);

describe('validateEnvelope', () => {
  it('has valid fixtures to check', () => {
    expect(load('fixtures/valid').length).toBeGreaterThanOrEqual(2);
  });

  it.each(load('fixtures/valid'))('accepts valid fixture %s', (_n: string, value: unknown) => {
    expect(validateEnvelope(value)).toEqual({ ok: true });
  });

  it.each(load('fixtures/invalid'))(
    'rejects invalid fixture %s with readable errors',
    (_n, value) => {
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
});

describe('v0.json', () => {
  it('equals emitJsonSchema() output (rebuild with `pnpm emit-schema`)', () => {
    expect(readFileSync(pkg('schema/v0.json'), 'utf8')).toBe(emitJsonSchema());
  });

  it('roots at PageEnvelope and defines SharedProps', () => {
    const doc = JSON.parse(emitJsonSchema());
    expect(doc.$ref).toBe('#/$defs/PageEnvelope');
    expect(Object.keys(doc.$defs)).toEqual(['PageEnvelope', 'SharedProps']);
  });
});
