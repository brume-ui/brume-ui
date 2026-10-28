import { describe, expect, test } from 'vitest';
import { CHART_SERIES_COUNT, chartRoles, chartSeries } from './chart';
import { contrastRatio } from './contrast';
import { semantic } from './semantic';

/*
 * The computable checks of the dataviz method (validate_palette.js), ported so a palette edit
 * that breaks colour-blind separation or contrast fails CI instead of being eyeballed.
 * ΔE is Euclidean OKLab distance × 100; CVD is Machado-Oliveira-Fernandes 2009 at severity 1.0.
 */

const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
} as const;

type Vec = [number, number, number];

function linear(hex: string): Vec {
  return [0, 2, 4].map((i) => {
    const c = Number.parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Vec;
}

function oklab([r, g, b]: Vec): Vec {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function simulate(rgb: Vec, kind: keyof typeof MACHADO): Vec {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return MACHADO[kind].map((row) =>
    clamp(row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]),
  ) as Vec;
}

function deltaE(a: string, b: string, kind?: keyof typeof MACHADO): number {
  const pa = oklab(kind ? simulate(linear(a), kind) : linear(a));
  const pb = oklab(kind ? simulate(linear(b), kind) : linear(b));
  return 100 * Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}

const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] } as const;

describe.each(['light', 'dark'] as const)('chart palette in %s', (mode) => {
  const palette = Object.values(chartSeries).map((v) => v[mode]);
  const surface = semantic.surface[mode];
  const adjacent = palette.slice(1).map((c, i) => [palette[i] as string, c] as const);

  test('has eight fixed slots', () => {
    expect(palette).toHaveLength(8);
    expect(CHART_SERIES_COUNT).toBe(8);
  });

  test('every slot sits in the lightness band with enough chroma', () => {
    for (const c of palette) {
      const [L, a, b] = oklab(linear(c));
      expect(L, c).toBeGreaterThanOrEqual(BAND[mode][0]);
      expect(L, c).toBeLessThanOrEqual(BAND[mode][1]);
      expect(Math.hypot(a, b), c).toBeGreaterThanOrEqual(0.1);
    }
  });

  test('neighbours stay apart under protanopia and deuteranopia (ΔE ≥ 8)', () => {
    for (const [a, b] of adjacent) {
      for (const kind of ['protan', 'deutan'] as const) {
        expect(deltaE(a, b, kind), `${a}↔${b} ${kind}`).toBeGreaterThanOrEqual(8);
      }
    }
  });

  test('neighbours stay apart for full-colour vision (ΔE ≥ 15)', () => {
    for (const [a, b] of adjacent) {
      expect(deltaE(a, b), `${a}↔${b}`).toBeGreaterThanOrEqual(15);
    }
  });

  test('every mark clears 3:1 on the card surface', () => {
    for (const c of [...palette, chartRoles['chart-muted'][mode]]) {
      expect(contrastRatio(c, surface), c).toBeGreaterThanOrEqual(3);
    }
  });

  test('gridlines stay recessive: quieter than the axis rule', () => {
    expect(contrastRatio(chartRoles['chart-grid'][mode], surface)).toBeLessThan(
      contrastRatio(chartRoles['chart-axis'][mode], surface),
    );
  });
});
