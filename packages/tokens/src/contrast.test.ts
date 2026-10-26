import { describe, expect, test } from 'vitest';
import { contrastPairs, contrastRatio } from './contrast';
import { semantic } from './semantic';

describe('contrast', () => {
  test('contrastRatio matches known values', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#0e7490')).toBeGreaterThan(5.3);
  });

  test('contrastRatio is symmetric', () => {
    expect(contrastRatio('#1f2a37', '#eef2f6')).toBeCloseTo(
      contrastRatio('#eef2f6', '#1f2a37'),
      10,
    );
  });

  test.each(['light', 'dark'] as const)('every declared pair passes in %s', (mode) => {
    for (const p of contrastPairs) {
      expect(
        contrastRatio(semantic[p.fg][mode], semantic[p.bg][mode]),
        `${p.fg} on ${p.bg}`,
      ).toBeGreaterThanOrEqual(p.min);
    }
  });

  test('text-muted passes on surface-canvas', () => {
    expect(contrastPairs).toContainEqual({ fg: 'text-muted', bg: 'surface-canvas', min: 4.5 });
    for (const mode of ['light', 'dark'] as const) {
      expect(
        contrastRatio(semantic['text-muted'][mode], semantic['surface-canvas'][mode]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('semantic covers the spec token names', () => {
    for (const name of [
      'surface-canvas',
      'surface',
      'surface-selected',
      'text',
      'text-muted',
      'border',
      'border-strong',
      'accent',
      'accent-tint',
      'accent-tint-text',
      'danger',
      'text-on-accent',
      'focus-ring',
      'success',
      'warning',
      'info',
    ]) {
      expect(semantic, name).toHaveProperty(name);
    }
  });
});
