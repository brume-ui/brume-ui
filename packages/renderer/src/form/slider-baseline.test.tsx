import type { FormDef } from '@brume-ui/brume-schema';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rowDefaults, withRequiredSliderMinimums } from './row-defaults';
import { useFormState } from './use-form-state';

const slider = (name: string, extra: Record<string, unknown> = {}) =>
  ({
    type: 'field',
    field: { type: 'slider', name, label: name, min: 2, max: 10, step: 2, ...extra },
  }) as const;

const form: FormDef = {
  layout: 'stacked',
  nodes: [
    slider('req', { required: true }),
    slider('opt'),
    slider('ro', { required: true, readOnly: true }),
    slider('off', { required: true, disabled: true }),
    { type: 'embeds', name: 'meta', label: 'M', children: [slider('deep', { required: true })] },
    {
      type: 'field',
      field: {
        type: 'repeater',
        name: 'rows',
        label: 'R',
        mode: 'json',
        nodes: [slider('lvl', { required: true })],
      },
    } as never,
  ],
};

describe('required slider baseline', () => {
  it('starts at min without being dirty, and leaves other sliders alone', () => {
    const { result } = renderHook(() => useFormState(form, { req: null, rows: [{}] }));
    expect(result.current.values.req).toBe(2);
    expect(result.current.dirty).toBe(false);
    expect(result.current.values.opt).toBeUndefined();
    expect(result.current.values.ro).toBeUndefined();
    expect(result.current.values.off).toBeUndefined();
    expect((result.current.values.meta as { deep: number }).deep).toBe(2);
    expect((result.current.values.rows as { lvl: number }[])[0]?.lvl).toBe(2);
  });
  it('keeps a stored value and a non-required null', () => {
    const { result } = renderHook(() => useFormState(form, { req: 6, opt: null }));
    expect(result.current.values.req).toBe(6);
    expect(result.current.values.opt).toBeNull();
  });
  it('reset applies it to the new baseline', () => {
    const { result } = renderHook(() => useFormState(form, { req: 4 }));
    act(() => result.current.setValue('req', 8));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset({ req: null }));
    expect(result.current.values.req).toBe(2);
    expect(result.current.dirty).toBe(false);
  });
  it('moving off min is a real change', () => {
    const { result } = renderHook(() => useFormState(form, {}));
    act(() => result.current.setValue('req', 4));
    expect(result.current.dirty).toBe(true);
  });
  it('returns the same object when nothing is empty', () => {
    const values = { req: 4, meta: { deep: 4 } };
    expect(withRequiredSliderMinimums(form.nodes, values)).toBe(values);
  });
  it('new rows start at min unless a default says otherwise', () => {
    expect(rowDefaults([slider('a', { required: true })])).toEqual({ a: 2 });
    expect(rowDefaults([slider('a', { required: true, defaultValue: 6 })])).toEqual({ a: 6 });
    expect(rowDefaults([slider('a')])).toEqual({});
  });
  it('fills existing relation rows', () => {
    const relation: FormDef = {
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: {
            type: 'relation',
            name: 'items',
            label: 'I',
            multiple: true,
            remote: { url: '/i' },
            fields: [slider('lvl', { required: true })],
          },
        },
      ],
    };
    const out = withRequiredSliderMinimums(relation.nodes, { items: [{ id: 'a' }] });
    expect(out.items).toEqual([{ id: 'a', lvl: 2 }]);
  });
});
