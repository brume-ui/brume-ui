import type { FormPage } from '@brume-ui/brume-schema';
import { describe, expect, it } from 'vitest';
import { AFTER_SAVE_KEY, readAfterSave, writeAfterSave } from './after-save';

describe('after-save persistence', () => {
  it('remembers only allowed choices and tolerates storage failures', () => {
    const page = {
      formId: 'test',
      after: { options: ['edit', 'list'], default: 'list' },
    } as FormPage;
    writeAfterSave('test', 'edit');
    expect(readAfterSave(page)).toBe('edit');
    localStorage.setItem(AFTER_SAVE_KEY('test'), 'view');
    expect(readAfterSave(page)).toBe('list');
  });
});
it('uses default when localStorage throws', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('blocked');
    },
  });
  try {
    const page = {
      formId: 'blocked',
      after: { options: ['edit', 'list'], default: 'list' },
    } as FormPage;
    expect(readAfterSave(page)).toBe('list');
    expect(() => writeAfterSave('blocked', 'edit')).not.toThrow();
  } finally {
    if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
  }
});
