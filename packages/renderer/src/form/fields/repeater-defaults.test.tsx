import type { FormDef, FormNode } from '@brume-ui/brume-schema';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import { Nodes } from '../layout/nodes';
import { type FormApi, useFormState } from '../use-form-state';

const strategy: FormNode = {
  type: 'field',
  field: {
    type: 'radio',
    name: 'strategy',
    label: 'Strategy',
    defaultValue: 'all',
    options: [
      { value: 'all', label: 'All' },
      { value: 'pick', label: 'Pick' },
    ],
  },
};
const repeater = (name: string, mode: 'json' | 'relation', nodes: FormNode[]): FormNode => ({
  type: 'field',
  field: { type: 'repeater', mode, name, label: name, nodes, sortable: false },
});
const form = (mode: 'json' | 'relation', depth: 1 | 2): FormDef => ({
  layout: 'stacked',
  nodes: [
    depth === 1
      ? repeater('outer', mode, [strategy])
      : repeater('outer', mode, [repeater('inner', mode, [strategy])]),
  ],
});

let api: FormApi;
function Harness({ def, values }: { def: FormDef; values: Record<string, unknown> }) {
  api = useFormState(def, values);
  return <Nodes nodes={def.nodes} api={api} idPrefix="t" layout="stacked" uploadUrl="/upload" />;
}
const key = (k: string, id?: string) => ({ _brume: id ? { key: k, id } : { key: k } });

describe.each(['relation', 'json'] as const)(
  'new %s repeater rows apply template defaults',
  (mode) => {
    it('root row', () => {
      renderWithBrume(<Harness def={form(mode, 1)} values={{ outer: [] }} />, { locale: 'en' });
      fireEvent.click(screen.getByRole('button', { name: 'Add outer' }));
      expect(api.getValue('outer.0.strategy')).toBe('all');
      expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true');
    });
    it('row nested in a stored row', () => {
      renderWithBrume(
        <Harness
          def={form(mode, 2)}
          values={{ outer: [{ ...key('o', mode === 'relation' ? '1' : undefined), inner: [] }] }}
        />,
        { locale: 'en' },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add inner' }));
      expect(api.getValue('outer.0.inner.0.strategy')).toBe('all');
      expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true');
    });
    it('row nested in a new row', () => {
      renderWithBrume(<Harness def={form(mode, 2)} values={{ outer: [] }} />, { locale: 'en' });
      fireEvent.click(screen.getByRole('button', { name: 'Add outer' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add inner' }));
      expect(api.getValue('outer.0.inner.0.strategy')).toBe('all');
      expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true');
    });
  },
);
