import type { FormDef } from '@brume-ui/brume-schema';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import { Nodes } from '../layout/nodes';
import { useFormState } from '../use-form-state';
import { collectFields } from '../validate';

const form: FormDef = {
  layout: 'stacked',
  nodes: [
    { type: 'html', html: '<p>說明 <strong>重點</strong></p><script>alert(1)</script>' },
    { type: 'html', html: '<p>附註</p>', label: '備註' },
    { type: 'field', field: { type: 'text', name: 'name', label: '名稱' } },
  ],
};

function Harness() {
  const api = useFormState(form, {});
  return <Nodes nodes={form.nodes} api={api} idPrefix="t" layout="stacked" />;
}

const relation: FormDef = {
  layout: 'stacked',
  nodes: [
    {
      type: 'field',
      field: {
        type: 'relation',
        name: 'items',
        label: 'Items',
        multiple: true,
        remote: { url: '/items' },
        fields: [
          { type: 'html', html: '<p>x</p>' },
          { type: 'field', field: { type: 'color', name: 'tone', label: 'Tone' } },
        ],
      },
    },
  ],
};
function Relation() {
  const api = useFormState(relation, { items: [{ id: 'a', tone: '#aabbcc' }] });
  return <Nodes nodes={relation.nodes} api={api} idPrefix="r" layout="stacked" />;
}

describe('html node', () => {
  it('renders sanitised content, with and without label', () => {
    const { container } = renderWithBrume(<Harness />);
    expect(screen.getByText('重點').tagName).toBe('STRONG');
    expect(screen.getByText('備註')).not.toBeNull();
    expect(screen.getByText('附註')).not.toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByLabelText('名稱')).not.toBeNull();
  });
  it('takes no part in validation', () => {
    expect(collectFields(form.nodes).map((f) => f.path)).toEqual(['name']);
  });
  it('a relation row containing one still collects and summarises row values', () => {
    renderWithBrume(<Relation />);
    expect(screen.getByRole('list', { name: 'Items' }).textContent).toMatch(/#aabbcc/);
  });
});
