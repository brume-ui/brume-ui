import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { FORM_HEADER, UPLOAD_PARAMS } from '../index';

const pkg = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(pkg(p), 'utf8')) as unknown;
const v0 = read('schema/v0.json') as { $defs: Record<string, unknown> };
const ajv = new Ajv2020({ strict: true });

const PAGE_DEFS = ['PageEnvelope', 'SharedProps', 'MenuItem'];
/** 有 fixtures/protocol/<def> 的請求／回應定義。 */
const PROTOCOL_DEFS = [
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
/** 表單的具名型別，由 PageEnvelope 的 fixtures 涵蓋。 */
const FORM_DEFS = ['FormNode', 'FieldDef', 'PlainFieldDef'];
/** 表單送出的請求／回應，有 fixtures/protocol/<def>。 */
const FORM_PROTOCOL_DEFS = ['FormSubmitRequest', 'FormSubmitResponse'];
const ORDER = [...PAGE_DEFS, ...PROTOCOL_DEFS, ...FORM_DEFS, ...FORM_PROTOCOL_DEFS];

const defs = readdirSync(pkg('fixtures/protocol')).sort();
const files = (def: string, kind: string) =>
  readdirSync(pkg(`fixtures/protocol/${def}/${kind}`)).filter((f) => f.endsWith('.json'));

describe('protocol $defs', () => {
  it('keeps the mandated $defs order', () => {
    expect(Object.keys(v0.$defs)).toEqual(ORDER);
  });

  it('has fixtures for every protocol def', () => {
    expect(defs).toEqual([...PROTOCOL_DEFS, ...FORM_PROTOCOL_DEFS].sort());
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

describe('form protocol constants', () => {
  it('names the form header and the upload parameters', () => {
    expect(FORM_HEADER).toBe('X-Brume-Form');
    expect(UPLOAD_PARAMS).toEqual({ file: 'file', field: 'field' });
  });
});
