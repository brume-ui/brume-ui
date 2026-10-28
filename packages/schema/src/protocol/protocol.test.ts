import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';

const pkg = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(pkg(p), 'utf8')) as unknown;
const v0 = read('schema/v0.json') as { $defs: Record<string, unknown> };
const ajv = new Ajv2020({ strict: true });

const ORDER = [
  'PageEnvelope',
  'SharedProps',
  'MenuItem',
  'ActionRequest',
  'ActionResponse',
  'CellUpdateRequest',
  'CellUpdateResponse',
  'ErrorResponse',
  'OptionsResponse',
  'PickerSearchResponse',
  'UploadTempResponse',
  'UploadValue',
];

const defs = readdirSync(pkg('fixtures/protocol')).sort();
const files = (def: string, kind: string) =>
  readdirSync(pkg(`fixtures/protocol/${def}/${kind}`)).filter((f) => f.endsWith('.json'));

describe('protocol $defs', () => {
  it('keeps the mandated $defs order', () => {
    expect(Object.keys(v0.$defs)).toEqual(ORDER);
  });

  it('has fixtures for every protocol def', () => {
    expect(defs).toEqual(ORDER.slice(3).sort());
  });

  describe.each(defs)('%s', (def) => {
    const check = ajv.compile({ $ref: `#/$defs/${def}`, $defs: v0.$defs });

    it('has at least one valid and one invalid fixture', () => {
      expect(files(def, 'valid').length).toBeGreaterThanOrEqual(1);
      expect(files(def, 'invalid').length).toBeGreaterThanOrEqual(1);
    });

    it.each(files(def, 'valid'))('accepts valid/%s', (f) => {
      expect(check(read(`fixtures/protocol/${def}/valid/${f}`)), JSON.stringify(check.errors)).toBe(
        true,
      );
    });

    it.each(files(def, 'invalid'))('rejects invalid/%s', (f) => {
      expect(check(read(`fixtures/protocol/${def}/invalid/${f}`))).toBe(false);
    });
  });
});
