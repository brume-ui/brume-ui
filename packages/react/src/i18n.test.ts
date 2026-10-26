import { describe, expect, it } from 'vitest';
import { createTranslator } from './i18n';

describe('i18n', () => {
  it('interpolates {name} vars', () => {
    expect(createTranslator('zh-TW')('pagination.page', { page: 3 })).toContain('3');
    expect(createTranslator('en')('pagination.page', { page: 3 })).toContain('3');
  });

  it('falls back to zh-TW for unknown locale', () => {
    const t = createTranslator('fr' as never);
    expect(t('common.close')).toBe(createTranslator('zh-TW')('common.close'));
  });

  it('applies message overrides', () => {
    expect(createTranslator('en', { 'common.close': 'Shut' })('common.close')).toBe('Shut');
  });
});
