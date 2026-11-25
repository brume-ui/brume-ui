import { describe, expect, it } from 'vitest';
import { normalizeHex } from './color';

describe('normalizeHex', () => {
  it.each([
    ['#ABC', false, '#aabbcc'],
    ['abc', false, '#aabbcc'],
    [' #A1B2C3 ', false, '#a1b2c3'],
    ['#12345', false, null],
    ['#gggggg', false, null],
    ['#abcd', false, null],
    ['#abcd', true, '#aabbccdd'],
    ['#aabbccdd', true, '#aabbccdd'],
    ['#11223344', false, null],
    ['#123456', true, '#123456'],
    ['', false, null],
    ['red', false, null],
  ] as const)('%s (alpha %s) -> %s', (input, alpha, expected) => {
    expect(normalizeHex(input, alpha)).toBe(expected);
  });
});
