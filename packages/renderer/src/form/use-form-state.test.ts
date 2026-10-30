import type { FormDef } from '@brume-ui/brume-schema';
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useFormState } from './use-form-state';

const form: FormDef = {
  layout: 'stacked',
  sections: 'tabs',
  nodes: [
    {
      type: 'section',
      key: 'one',
      title: 'One',
      children: [
        {
          type: 'field',
          field: {
            type: 'text',
            name: 'sku',
            label: 'SKU',
            rules: [{ rule: 'required', message: 'required' }],
          },
        },
      ],
    },
    {
      type: 'section',
      key: 'two',
      title: 'Two',
      children: [
        {
          type: 'embeds',
          name: 'meta',
          label: 'Meta',
          children: [
            {
              type: 'field',
              field: {
                type: 'text',
                name: 'name',
                label: 'Name',
                rules: [{ rule: 'required', message: 'name required' }],
              },
            },
          ],
        },
      ],
    },
    {
      type: 'field',
      field: {
        type: 'text',
        name: 'locked',
        label: 'Locked',
        readOnly: true,
        rules: [{ rule: 'required', message: 'locked' }],
      },
    },
  ],
};
it('is clean after reverting and compares object keys stably', () => {
  const { result } = renderHook(() => useFormState(form, { sku: 'a', meta: { x: 1, y: 2 } }));
  act(() => result.current.setValue('sku', 'b'));
  expect(result.current.dirty).toBe(true);
  act(() => {
    result.current.setValue('sku', 'a');
    result.current.setValue('meta', { y: 2, x: 1 });
  });
  expect(result.current.dirty).toBe(false);
});
it('waits for blur then validates live and validates every tab on submit', () => {
  const { result } = renderHook(() => useFormState(form, { sku: 'a' }));
  act(() => result.current.setValue('sku', ''));
  expect(result.current.errors).toEqual({});
  act(() => result.current.touch('sku'));
  expect(result.current.errors).toEqual({ sku: ['required'] });
  act(() => result.current.setValue('sku', 'valid'));
  expect(result.current.errors).toEqual({});
  act(() => {
    expect(result.current.validateAll()).toBe(false);
  });
  expect(result.current.errors).toEqual({ 'meta.name': ['name required'] });
  act(() => result.current.setValue('meta.name', 'valid'));
  expect(result.current.errors).toEqual({});
  act(() => {
    expect(result.current.validateAll()).toBe(true);
  });
  act(() => result.current.setValue('meta.name', ''));
  expect(result.current.errors).toEqual({ 'meta.name': ['name required'] });
});
it('overrides client errors, keeps unknown server errors and clears changed related paths only', () => {
  const { result } = renderHook(() => useFormState(form, { sku: '', meta: { name: '' } }));
  act(() => {
    result.current.validateAll();
    result.current.setServerErrors({
      sku: ['server'],
      'meta.name': ['server name'],
      total: ['unknown'],
      skux: ['keep'],
    });
  });
  expect(result.current.errors.sku).toEqual(['server']);
  act(() => result.current.setValue('sku', 'ok'));
  expect(result.current.errors).toEqual({
    'meta.name': ['server name'],
    total: ['unknown'],
    skux: ['keep'],
  });
  act(() => result.current.setValue('meta', { name: 'ok' }));
  expect(result.current.errors).toEqual({ total: ['unknown'], skux: ['keep'] });
  act(() => {
    expect(result.current.validateAll()).toBe(false);
  });
});
it('clears parent server errors when a child changes and retains errors on no-op writes', () => {
  const { result } = renderHook(() => useFormState(form, { meta: { name: 'old' } }));
  act(() => result.current.setServerErrors({ meta: ['parent'], 'meta.name': ['child'] }));
  act(() => result.current.setValue('meta.name', 'old'));
  expect(result.current.errors.meta).toEqual(['parent']);
  act(() => result.current.setValue('meta.name', 'new'));
  expect(result.current.errors).toEqual({});
});
it('resets values, touched/errors and baseline and tracks uploads with idempotent cleanup', () => {
  const { result } = renderHook(() => useFormState(form, { sku: 'a' }));
  let finish!: () => void;
  act(() => {
    result.current.setValue('sku', 'b');
    result.current.touch('sku');
    result.current.setServerErrors({ total: ['error'] });
    finish = result.current.trackUpload();
    result.current.setSubmitting(true);
  });
  expect(result.current.pendingUploads).toBe(1);
  expect(result.current.submitting).toBe(true);
  act(() => result.current.reset({ sku: 'c' }));
  expect(result.current.values).toEqual({ sku: 'c' });
  expect(result.current.dirty).toBe(false);
  expect(result.current.errors).toEqual({});
  act(() => {
    finish();
    finish();
  });
  expect(result.current.pendingUploads).toBe(0);
  act(() => {
    result.current.setValue('sku', 'd');
    result.current.reset();
  });
  expect(result.current.getValue('sku')).toBe('c');
});
it('uses current values for multiple synchronous writes and validateAll', () => {
  const { result } = renderHook(() => useFormState(form, {}));
  act(() => {
    result.current.setValue('sku', 'ok');
    result.current.setValue('meta.name', 'ok');
    expect(result.current.validateAll()).toBe(true);
  });
  expect(result.current.values).toEqual({ sku: 'ok', meta: { name: 'ok' } });
});
