import { readFileSync } from 'node:fs';
import { collectFields, validateValue } from '@brume-ui/brume-renderer';
import {
  ClientRuleSchema,
  ConditionSchema,
  DisplaySchema,
  FieldDefSchema,
  FilterInputSchema,
  FormNodeSchema,
  InlineEditorSchema,
} from '@brume-ui/brume-schema';
import { describe, expect, it } from 'vitest';
import { DEMO_FEATURES, filterDemoFeatures, getDemoFeature } from './demo-catalog';
import { buildFormPage } from './pages/form-data';
import { INDEX_ENTRIES, ROUTES, SHELL_ROUTE } from './routes';

describe('implemented demo catalog', () => {
  it('keeps unique stable IDs, registered destinations and actionable metadata', () => {
    expect(new Set(DEMO_FEATURES.map((feature) => feature.id)).size).toBe(DEMO_FEATURES.length);
    const names = [...ROUTES.map((route) => route.name), SHELL_ROUTE];
    expect(new Set(names).size).toBe(names.length);
    for (const feature of DEMO_FEATURES) {
      expect(feature.id).toMatch(/^[a-z][A-Za-z0-9.-]+$/);
      if (feature.persistence === 'database') {
        expect(feature.href).toBe('http://127.0.0.1:8100/admin/compositions');
      } else {
        expect(names).toContain(feature.href.replace(/^#\//, '').split('?')[0]);
      }
      expect(feature.title.length).toBeGreaterThan(1);
      expect(feature.summary.length).toBeGreaterThan(8);
      expect(feature.steps.length).toBeGreaterThan(0);
      expect(feature.steps.every((step) => step.length > 8)).toBe(true);
      expect(feature.expected.length).toBeGreaterThan(8);
      expect(['memory', 'database', 'visual', 'contract']).toContain(feature.persistence);
      expect(feature.sources.length).toBeGreaterThan(0);
      expect(getDemoFeature(feature.id)).toBe(feature);
    }
    expect(getDemoFeature('not-implemented')).toBeUndefined();
    // Every old route remains discoverable, including the special shell route.
    for (const entry of INDEX_ENTRIES.filter((entry) => entry.name !== 'demos')) {
      expect(DEMO_FEATURES.some((feature) => feature.href === `#/${entry.name}`)).toBe(true);
    }
  });

  it('gives the direct server422 target instructions for its actual selector and field', () => {
    const feature = getDemoFeature('form.behavior.server422');
    expect(feature?.href).toBe('#/form-behaviors?example=form.behavior.server422');
    const steps = feature?.steps.join(' ') ?? '';
    for (const label of ['模擬回應', '422 欄位錯誤', '名稱', '成功'])
      expect(steps).toContain(label);
    expect(steps).not.toContain('載入無效控制值');
    expect(feature?.expected).toContain('此名稱已被使用。');
    const manifest = readFileSync(
      new URL('../../../docs/demo-coverage.md', import.meta.url),
      'utf8',
    )
      .split('\n')
      .find((line) => line.startsWith('| `form.behavior.server422`'));
    expect(manifest).toContain('422 欄位錯誤');
    expect(manifest).toContain('此名稱已被使用。');
    expect(manifest).not.toContain('載入無效控制值');
  });
  it('points both gift IDs at real memory routes with reset and canonical-baseline instructions', () => {
    const coverage = readFileSync(
      new URL('../../../docs/demo-coverage.md', import.meta.url),
      'utf8',
    );
    for (const [scope, route] of [
      ['root', 'form-conditions'],
      ['row', 'form-composition'],
    ] as const) {
      const id = `gift.${scope}-three-branches`;
      const feature = getDemoFeature(id);
      expect(feature?.href).toBe(`#/${route}`);
      expect(feature?.persistence).toBe('memory');
      const instructions = feature?.steps.join(' ') ?? '';
      for (const label of ['優惠券', '點數', '載入無效贈品類型', '儲存'])
        expect(instructions).toContain(label);
      expect(feature?.expected).toContain('完整基準');
      expect(feature?.expected).toContain('沒有發放');
      const row = coverage.split('\n').find((line) => line.startsWith(`| \`${id}\``));
      expect(row).toContain('READY');
      expect(row).toContain(`#/${route} / memory`);
      expect(row).not.toContain('GAP-T4');
    }
  });
  it('links persistent gift scenarios to the real workbench and labels their upgrade prerequisites', () => {
    for (const id of ['gift.database-three-branches', 'gift.database-upgrade']) {
      const feature = getDemoFeature(id);
      expect(feature?.href).toBe('http://127.0.0.1:8100/admin/compositions');
      expect(feature?.persistence).toBe('database');
      expect(feature?.steps.join(' ')).toContain('升級');
      expect(feature?.expected).toContain('重新開啟');
    }
  });

  it('searches title, instructions and feature IDs within the selected category', () => {
    expect(filterDemoFeatures('遠端', 'form').map((feature) => feature.id)).toContain(
      'form.remote-options',
    );
    expect(filterDemoFeatures('form.remote-options', 'grid')).toEqual([]);
    expect(
      filterDemoFeatures('  FORM.REMOTE-OPTIONS  ', 'all').map((feature) => feature.id),
    ).toEqual(['form.remote-options']);
    expect(filterDemoFeatures('never-a-demo', 'all')).toEqual([]);
  });

  it('resolves every inventory row to an actionable catalog target without dropping original IDs', () => {
    const coverage = readFileSync(
      new URL('../../../docs/demo-coverage.md', import.meta.url),
      'utf8',
    );
    const rows = coverage.split('\n').filter((line) => /^\| `[^`]+`/.test(line));
    expect(rows).toHaveLength(342);
    const ids = rows.map((line) => line.match(/^\| `([^`]+)`/)?.[1]);
    expect(new Set(ids).size).toBe(342);
    for (const row of rows) {
      expect(row).toMatch(/\| READY\s*\|/);
      const target = row.split('|')[4]?.trim().replace(/^`|`$/g, '') ?? '';
      if (target.startsWith('#/') || target.startsWith('http')) {
        const href = target.split(' / ')[0];
        expect(
          DEMO_FEATURES.some((feature) => feature.href === href),
          `Unmapped ${target}`,
        ).toBe(true);
      } else expect(getDemoFeature(target), `Unknown legacy target ${target}`).toBeTruthy();
    }
  });

  it('accounts for public source variants independently of the ready catalog', () => {
    const coverage = readFileSync(
      new URL('../../../docs/demo-coverage.md', import.meta.url),
      'utf8',
    ).replace(/[ \t]+/g, ' ');
    // Read the actual exported declarations, not a list derived from the catalog itself.
    const constants = (schema: Record<string, unknown>): string[] => {
      if (typeof schema.const === 'string') return [schema.const];
      return (schema.anyOf as Record<string, unknown>[] | undefined)?.flatMap(constants) ?? [];
    };
    const variants = (schema: Record<string, unknown>, property: string): string[] => {
      const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
      if (properties?.[property]) return constants(properties[property]);
      return (
        (schema.anyOf as Record<string, unknown>[] | undefined)?.flatMap((item) =>
          variants(item, property),
        ) ?? []
      );
    };
    for (const [prefix, schema, property] of [
      ['form.field', FieldDefSchema, 'type'],
      ['form.layout', FormNodeSchema, 'type'],
      ['form.condition', ConditionSchema, 'op'],
      ['form.rule', ClientRuleSchema, 'rule'],
      ['grid.display', DisplaySchema, 'type'],
      ['grid.editor', InlineEditorSchema, 'type'],
      ['grid.input', FilterInputSchema, 'type'],
    ] as const) {
      const names = [...new Set(variants(schema, property))];
      expect(names.length).toBeGreaterThan(3);
      for (const name of names) {
        expect(coverage, `Unaccounted source feature ${prefix}.${name}`).toContain(
          `| \`${prefix}.${name}\` |`,
        );
      }
    }
    for (const feature of DEMO_FEATURES) expect(coverage).toContain(`\`${feature.id}\``);
    // Pin known features so removing a declaration cannot silently lower the denominator.
    expect(variants(FieldDefSchema, 'type')).toContain('relation');
    expect(variants(InlineEditorSchema, 'type')).toContain('tags');
    expect(variants(FilterInputSchema, 'type')).toContain('range');
    expect(getDemoFeature('contract.query')?.href).toBe(
      '#/public-contracts?example=contract.query',
    );
    expect(coverage).toContain('| `grid.operator.findInSet` |');
    expect(coverage).toContain('| `lifecycle.upload-rollback` |');
  });

  it('accounts for every public React component and context export in the source inventory', () => {
    const source = readFileSync(
      new URL('../../../packages/react/src/index.ts', import.meta.url),
      'utf8',
    );
    const coverage = readFileSync(
      new URL('../../../docs/demo-coverage.md', import.meta.url),
      'utf8',
    ).replace(/[ \t]+/g, ' ');
    const names = [...source.matchAll(/export (type )?\{([^}]+)\}/gs)]
      .filter((match) => !match[1])
      .flatMap((match) => (match[2] ?? '').split(',').map((name) => name.trim()))
      .filter((name) => /^[A-Z][A-Za-z]+$/.test(name));
    expect(names).toContain('BrumeProvider');
    expect(names).toContain('RelationPicker');
    for (const name of names) expect(coverage).toContain(`| \`react.${name}\` |`);
  });

  it('exposes previously blocked validation triggers with focused inputs while retaining original control bounds', () => {
    const coverage = readFileSync(
      new URL('../../../docs/demo-coverage.md', import.meta.url),
      'utf8',
    );
    const rows = coverage
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .map((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim().replace(/^`|`$/g, '')),
      );
    const row = (id: string) => rows.find((cells) => cells[0] === id);
    const fields = collectFields(buildFormPage().form.nodes);
    expect(fields.find(({ path }) => path === 'quantity')?.def).toMatchObject({
      min: 0,
      step: 1,
    });
    expect(fields.find(({ path }) => path === 'title')?.def).toMatchObject({ maxLength: 120 });
    for (const id of ['form.rule.integer', 'form.rule.numeric', 'form.rule.maxLength']) {
      expect(row(id)?.[2]).toBe('READY');
      expect(row(id)?.[3]).toContain(`#/form-behaviors?example=${id}`);
    }
    const weight = fields.find(({ path }) => path === 'weight')?.def;
    if (!weight) throw new Error('Missing weight demo');
    expect(weight).toMatchObject({ type: 'decimal', decimals: 3 });
    expect(validateValue(weight, '0.250')).toBe('重量不能小於 0.5。');
    expect(validateValue(weight, '0.500')).toBeNull();
    expect(row('form.rule.min')?.[2]).toBe('READY');
    expect(row('form.field.number')?.[1]).not.toContain('負數');
    expect(row('react.RelationPicker')?.[1]).not.toContain('單多選');
    expect(row('react.RelationPicker')?.[4]).toContain('pages/form-relations.tsx');
    expect(row('relation.picker-single-multiple')?.[2]).toBe('READY');
    for (const status of ['READY', 'GAP-T2', 'GAP-T3', 'GAP-T4', 'GAP-T5', 'GAP-T6']) {
      expect(coverage).toContain(`${status} ${rows.filter((cells) => cells[2] === status).length}`);
    }
  });
});
