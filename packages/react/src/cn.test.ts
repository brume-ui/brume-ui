import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('merges conflicting br:-prefixed utilities, last wins', () => {
    expect(cn('br:p-2', 'br:p-4')).toBe('br:p-4');
  });

  it('leaves unprefixed classes untouched', () => {
    expect(cn('p-2', 'p-4')).toBe('p-2 p-4');
    expect(cn('p-2', 'br:p-4')).toBe('p-2 br:p-4');
  });

  it('handles conditional inputs', () => {
    expect(cn('br:flex', false && 'x', { 'br:p-2': true })).toBe('br:flex br:p-2');
  });
});
