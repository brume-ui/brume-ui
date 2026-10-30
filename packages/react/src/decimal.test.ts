import { expect, it } from 'vitest';
import * as api from './index';

it('canonicalizes decimal strings exactly and distinguishes invalid from empty', () => {
  expect(typeof api.canonicalDecimal).toBe('function');
  expect(api.canonicalDecimal('09007199254740993.105', 2)).toBe('9007199254740993.11');
  expect(api.canonicalDecimal('-0.004', 2)).toBe('0.00');
  expect(api.canonicalDecimal('-.5', 2)).toBe('-0.50');
  expect(api.canonicalDecimal('', 2)).toBe('');
  for (const value of [' ', '1e3', '1x', '-', '.', '1,000'])
    expect(api.canonicalDecimal(value, 2)).toBeNull();
  expect(() => api.canonicalDecimal('1', -1)).toThrow();
});
