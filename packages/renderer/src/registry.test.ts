import { describe, expect, it } from 'vitest';
import { createRegistry } from './registry';

const Foo = () => null;

describe('createRegistry', () => {
  it('returns registered components and undefined otherwise', () => {
    const r = createRegistry({ mode: 'vite', components: { Foo } });
    expect(r.mode).toBe('vite');
    expect(r.get('Foo')).toBe(Foo);
    expect(r.get('Bar')).toBeUndefined();
  });
  it('does not resolve inherited object keys', () => {
    expect(createRegistry({ mode: 'vite' }).get('toString')).toBeUndefined();
  });
});
