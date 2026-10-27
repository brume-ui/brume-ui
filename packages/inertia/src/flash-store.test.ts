import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markFlashSeen, resetSeenFlashMemory, SEEN_FLASH_STORAGE_KEY } from './flash';

beforeEach(() => {
  sessionStorage.clear();
  resetSeenFlashMemory();
});
afterEach(() => vi.restoreAllMocks());

describe('seen flash ids', () => {
  it('survives a module-state reset by rehydrating from sessionStorage', () => {
    expect(markFlashSeen('a')).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(SEEN_FLASH_STORAGE_KEY) ?? '[]')).toEqual(['a']);
    resetSeenFlashMemory();
    expect(markFlashSeen('a')).toBe(false);
    expect(markFlashSeen('b')).toBe(true);
  });

  it('keeps only the most recent 50 ids', () => {
    for (let i = 0; i < 51; i++) markFlashSeen(`id${i}`);
    const stored = JSON.parse(sessionStorage.getItem(SEEN_FLASH_STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(50);
    expect(stored[0]).toBe('id1');
    expect(markFlashSeen('id0')).toBe(true);
  });

  it('falls back to memory when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(markFlashSeen('x')).toBe(true);
    expect(markFlashSeen('x')).toBe(false);
  });
});
