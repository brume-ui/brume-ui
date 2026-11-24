import { describe, expect, it } from 'vitest';
import { whileApplying } from './applying';

describe('whileApplying', () => {
  it('sets the flag only while writing', () => {
    const flag = { current: false };
    let during: boolean | undefined;
    whileApplying(flag, () => {
      during = flag.current;
    });
    expect(during).toBe(true);
    expect(flag.current).toBe(false);
  });

  it('resets the flag when the write throws (edits keep reaching the form)', () => {
    const flag = { current: false };
    expect(() =>
      whileApplying(flag, () => {
        throw new Error('bad value');
      }),
    ).toThrow('bad value');
    expect(flag.current).toBe(false);
  });
});
