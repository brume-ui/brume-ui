import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from './memory-adapter';

describe('createMemoryAdapter', () => {
  it('visit updates currentUrl and records the call', () => {
    const a = createMemoryAdapter('/start');
    expect(a.currentUrl()).toBe('/start');
    a.visit('/users?page=2', { replace: true });
    expect(a.currentUrl()).toBe('/users?page=2');
    expect(a.calls).toEqual([{ fn: 'visit', args: ['/users?page=2', { replace: true }] }]);
  });

  it('records reload and submit', () => {
    const a = createMemoryAdapter();
    a.reload({ only: ['rows'] });
    a.submit('post', '/x', { a: 1 });
    expect(a.calls.map((c) => c.fn)).toEqual(['reload', 'submit']);
  });
});
