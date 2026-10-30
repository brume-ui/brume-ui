import { describe, expect, it } from 'vitest';
import { getAt, joinPath, setAt } from './paths';

describe('value paths', () => {
  it('creates arrays for numeric segments without mutating the original', () => {
    const original = { other: { keep: true } };
    const next = setAt(original, 'a.0.b', 1);
    expect(next).toEqual({ other: { keep: true }, a: [{ b: 1 }] });
    expect(original).toEqual({ other: { keep: true } });
    expect(next.other).toBe(original.other);
  });
  it('copies existing arrays and supports root replacement and lookup', () => {
    const original = { a: [{ b: 1 }, { b: 2 }] };
    const next = setAt(original, 'a.0.b', 3);
    expect(next).toEqual({ a: [{ b: 3 }, { b: 2 }] });
    expect(original.a[0]?.b).toBe(1);
    expect(next.a[1]).toBe(original.a[1]);
    expect(getAt(next, 'a.0.b')).toBe(3);
    expect(getAt(next, 'missing.x')).toBeUndefined();
    expect(getAt(next, '')).toBe(next);
    expect(setAt(original, '', { replacement: true })).toEqual({ replacement: true });
  });
  it('joins paths with empty roots', () => {
    expect(joinPath('', 'name')).toBe('name');
    expect(joinPath('a', '')).toBe('a');
    expect(joinPath('a.0', 'b')).toBe('a.0.b');
  });
  it.each(['__proto__.polluted', 'constructor.prototype.polluted', 'a.__proto__.polluted'])(
    'rejects unsafe writes and reads: %s',
    (path) => {
      expect(() => setAt({}, path, true)).toThrow();
      expect(getAt({}, path)).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    },
  );
  it('does not read inherited properties', () => {
    expect(getAt({}, 'toString')).toBeUndefined();
    expect(setAt({}, 'toString.value', 1)).toEqual({ toString: { value: 1 } });
  });
});
