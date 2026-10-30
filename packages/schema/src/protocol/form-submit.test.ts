import { Value } from '@sinclair/typebox/value';
import { expect, it } from 'vitest';
import { FormSubmitResponseSchema } from './form';

it('accepts saved records or explicit cancellation with required feedback', () => {
  expect(Value.Check(FormSubmitResponseSchema, { id: 1, urls: { edit: '/1' } })).toBe(true);
  expect(
    Value.Check(FormSubmitResponseSchema, {
      cancelled: true,
      feedback: { toast: { type: 'info', message: 'Stopped' } },
    }),
  ).toBe(true);
  expect(Value.Check(FormSubmitResponseSchema, { cancelled: true })).toBe(false);
  expect(
    Value.Check(FormSubmitResponseSchema, { cancelled: true, id: 1, urls: { edit: '/1' } }),
  ).toBe(false);
  expect(Value.Check(FormSubmitResponseSchema, { feedback: {} })).toBe(false);
  expect(Value.Check(FormSubmitResponseSchema, { cancelled: false, feedback: {} })).toBe(false);
});
