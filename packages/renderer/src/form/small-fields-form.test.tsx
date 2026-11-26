import type { FormDef } from '@brume-ui/brume-schema';
import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { canonicalizeFieldValue } from './conditions';
import { FormView } from './form-view';
import { Nodes } from './layout/nodes';
import { useFormState } from './use-form-state';

const form: FormDef = {
  layout: 'stacked',
  nodes: [
    { type: 'field', field: { type: 'range', name: 'span', label: '區間', decimals: 1 } },
    { type: 'field', field: { type: 'timeRange', name: 'hours', label: '時段' } },
    { type: 'field', field: { type: 'ip', name: 'addr', label: 'IP', version: 4 } },
  ],
};

function ValidateHarness() {
  const api = useFormState(form, { span: { start: '3', end: '2' } });
  return (
    <>
      <button type="button" onClick={() => api.validateAll()}>
        go
      </button>
      <FormView form={form} api={api} />
    </>
  );
}

describe('client validation in the form state', () => {
  it('keys range errors by bound once touched', () => {
    const { result } = renderHook(() => useFormState(form, { span: { start: '3', end: '2' } }));
    expect(result.current.errors).toEqual({});
    act(() => result.current.touch('span'));
    expect(Object.keys(result.current.errors)).toEqual(['span.end']);
    expect(result.current.validateAll()).toBe(false);
  });
  it('a bad timeRange bound and an overnight range', () => {
    const { result } = renderHook(() =>
      useFormState(form, { hours: { start: '22:00', end: '06:00' } }),
    );
    expect(result.current.validateAll()).toBe(true);
    act(() => result.current.setValue('hours', { start: '25:00' }));
    act(() => {
      result.current.validateAll();
    });
    expect(Object.keys(result.current.errors)).toEqual(['hours.start']);
  });
  it('ip version is enforced and blank passes', () => {
    const { result } = renderHook(() => useFormState(form, { addr: '::1' }));
    expect(result.current.validateAll()).toBe(false);
    act(() => result.current.setValue('addr', null));
    expect(result.current.validateAll()).toBe(true);
  });
  it('the order error shows under the end bound in the view', () => {
    renderWithBrume(<ValidateHarness />);
    fireEvent.click(screen.getByText('go'));
    const error = screen.getByText('結束值不可小於起始值');
    expect(screen.getByLabelText('區間（迄）').getAttribute('aria-describedby')).toContain(
      error.id,
    );
    expect(screen.getByLabelText('區間（起）').getAttribute('aria-invalid')).toBeNull();
  });
});

describe('canonical values for conditions', () => {
  it.each([
    [{ type: 'rate', decimals: 2 }, '5.50', true],
    [{ type: 'rate', decimals: 2 }, '5.555', false],
    [{ type: 'slider', min: 0, max: 1, step: 0.1 }, 0.3, true],
    [{ type: 'slider', min: 0, max: 1, step: 0.1 }, 'abc', false],
    [{ type: 'range', decimals: 1 }, { start: '1' }, true],
    [{ type: 'range', decimals: 1 }, 'x', false],
    [{ type: 'timeRange' }, { start: 1 }, false],
    [{ type: 'ip' }, 5, false],
    [{ type: 'ip' }, '::1', true],
    [{ type: 'time' }, '09:05', true],
    [{ type: 'icon' }, 'star', true],
  ])('%j with %j valid=%s', (extra, value, valid) => {
    expect(canonicalizeFieldValue({ name: 'v', label: 'V', ...extra } as never, value).valid).toBe(
      valid,
    );
  });
});

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
          { type: 'button', label: '說明', href: '/help' },
          { type: 'field', field: { type: 'ip', name: 'addr', label: 'IP' } },
        ],
      },
    },
  ],
};
function RelationHarness() {
  const api = useFormState(relation, { items: [{ id: 'a', addr: '10.0.0.1' }] });
  return <Nodes nodes={relation.nodes} api={api} idPrefix="r" layout="stacked" />;
}

describe('button node inside a relation row', () => {
  it('summarises the row values and ignores the button', () => {
    renderWithBrume(<RelationHarness />);
    expect(screen.getByRole('list', { name: 'Items' }).textContent).toMatch(/10\.0\.0\.1/);
  });
});
