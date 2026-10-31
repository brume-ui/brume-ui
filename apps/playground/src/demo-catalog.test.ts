import { readFileSync } from 'node:fs';
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
import { INDEX_ENTRIES, ROUTES, SHELL_ROUTE } from './routes';

describe('implemented demo catalog', () => {
  it('keeps unique stable IDs, registered destinations and actionable metadata', () => {
    expect(new Set(DEMO_FEATURES.map((feature) => feature.id)).size).toBe(DEMO_FEATURES.length);
    const names = [...ROUTES.map((route) => route.name), SHELL_ROUTE];
    expect(new Set(names).size).toBe(names.length);
    for (const feature of DEMO_FEATURES) {
      expect(feature.id).toMatch(/^[a-z][a-z0-9.-]+$/);
      expect(names).toContain(feature.href.replace(/^#\//, '').split('?')[0]);
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
});
