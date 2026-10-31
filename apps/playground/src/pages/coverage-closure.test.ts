import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { getDemoFeature } from '../demo-catalog';
import { CLOSURE_EXAMPLES } from './coverage-closure-data';

it('closes all 47 assigned IDs with runnable targets or concrete source-backed contract cases', () => {
  // Freeze the assigned IDs independently of catalog/data so removing a mapping fails CI.
  const ids = [
    'lifecycle.save-reload',
    'lifecycle.readonly',
    'lifecycle.inactive',
    'lifecycle.password',
    'lifecycle.exact-values',
    'lifecycle.embeds',
    'lifecycle.custom-mapping',
    'lifecycle.unique-server-rules',
    'lifecycle.belongs-to',
    'lifecycle.has-many',
    'lifecycle.pivot',
    'lifecycle.intermediary',
    'lifecycle.repeater-sync',
    'lifecycle.atomic-graph',
    'lifecycle.options-authority',
    'lifecycle.creating',
    'lifecycle.editing',
    'lifecycle.submitted',
    'lifecycle.saving',
    'lifecycle.saved',
    'lifecycle.deleting',
    'lifecycle.deleted',
    'lifecycle.upload-temp',
    'lifecycle.upload-archive',
    'lifecycle.upload-nested',
    'lifecycle.upload-rollback',
    'lifecycle.upload-removal',
    'lifecycle.form-transport',
    'react.Alert',
    'react.CompactTable',
    'react.Link',
    'react.LinkButton',
    'react.ProgressBar',
    'react.StaticValue',
    'react.FieldLayoutContext',
    'react.BrumeProvider',
    'renderer.page-dispatch',
    'renderer.dashboard-blocks',
    'renderer.registry',
    'renderer.form-api',
    'renderer.grid-api',
    'contract.protocol',
    'contract.query',
    'contract.adapter',
    'contract.inertia',
    'contract.schema',
    'style.tokens',
  ];
  expect(ids).toHaveLength(47);
  expect(CLOSURE_EXAMPLES.map((item) => item.id).sort()).toEqual(ids.sort());
  const coverage = readFileSync(
    new URL('../../../../docs/demo-coverage.md', import.meta.url),
    'utf8',
  );
  for (const item of CLOSURE_EXAMPLES) {
    expect(item.fixture.length).toBeGreaterThan(15);
    expect(item.outcome.length).toBeGreaterThan(15);
    expect(item.evidence.length).toBeGreaterThan(0);
    expect(getDemoFeature(item.id)?.href).toBe(`#/public-contracts?example=${item.id}`);
    const row = coverage.split('\n').find((line) => line.startsWith(`| \`${item.id}\``));
    expect(row).toContain('READY');
    expect(row).toContain(`?example=${item.id}`);
    for (const source of item.evidence.filter((path) => path.startsWith('brume-ui:'))) {
      expect(
        readFileSync(new URL(`../../../../${source.slice(9)}`, import.meta.url), 'utf8').length,
      ).toBeGreaterThan(0);
    }
    if (item.id.startsWith('lifecycle.')) {
      expect(item.testName).toBeTruthy();
      expect(item.command).toContain('--filter=');
      expect(item.persistence).toBe('contract');
    }
  }
});
