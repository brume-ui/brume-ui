import { describe, expect, test } from 'vitest';
import { contrastPairs, contrastRatio, mixOklab, pairColors } from './contrast';
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
      const { fg, bg } = pairColors(p, mode);
      const on = p.bgMix ? `${p.bgMix.token} ${p.bgMix.percent}% over ${p.bg}` : p.bg;
      expect(contrastRatio(fg, bg), `${p.fg} on ${on}`).toBeGreaterThanOrEqual(p.min);
    }
  });

  test('mixOklab matches color-mix(in oklab) at the ends and near the accent-tint fallback', () => {
    expect(mixOklab('#0e7490', 100, '#ffffff')).toBe('#0e7490');
    expect(mixOklab('#0e7490', 0, '#ffffff')).toBe('#ffffff');
    // The fallback hex for accent-tint was hand-picked close to the derived value.
    const derived = mixOklab(semantic.accent.light, 12, semantic.surface.light);
    expect(contrastRatio(derived, semantic['accent-tint'].light)).toBeLessThan(1.05);
  });

  test('covers the Badge tones and the outline Button text', () => {
    for (const tone of ['success', 'warning', 'danger', 'info'] as const) {
      expect(contrastPairs).toContainEqual({
        fg: tone,
        bg: 'surface',
        min: 4.5,
        bgMix: { token: tone, percent: 8 },
      });
    }
    expect(contrastPairs).toContainEqual({ fg: 'accent-tint-text', bg: 'surface', min: 4.5 });
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

  test.each(['light', 'dark'] as const)('scrim darkens what is behind a modal in %s', (mode) => {
    // A scrim lighter than the canvas would wash the page out instead of dimming it.
    const scrim = semantic.scrim[mode];
    const canvas = semantic['surface-canvas'][mode];
    expect(contrastRatio(scrim, '#000000')).toBeLessThan(contrastRatio(canvas, '#000000'));
  });
});
