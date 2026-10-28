import { type SemanticToken, semantic } from './semantic';

function channel(hex: string, i: number): number {
  const v = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`Expected #rrggbb, got "${hex}"`);
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

/** WCAG 2.x contrast ratio between two `#rrggbb` colors. */
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

function hexToOklab(hex: string): [number, number, number] {
  const [r, g, b] = [0, 1, 2].map((i) =>
    toLinear(Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255),
  ) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToHex([L, a, b]: [number, number, number]): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(Math.max(fromLinear(v), 0), 1) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** CSS `color-mix(in oklab, a percent%, b)` for two `#rrggbb` colours. */
export function mixOklab(a: string, percent: number, b: string): string {
  const p = percent / 100;
  const [l1, a1, b1] = hexToOklab(a);
  const [l2, a2, b2] = hexToOklab(b);
  const lerp = (x: number, y: number) => x * p + y * (1 - p);
  return oklabToHex([lerp(l1, l2), lerp(a1, a2), lerp(b1, b2)]);
}

export interface ContrastPair {
  fg: SemanticToken;
  bg: SemanticToken;
  min: 4.5 | 3;
  /** The background is `color-mix(in oklab, <token> <percent>%, <bg>)` (tinted pills). */
  bgMix?: { token: SemanticToken; percent: number };
}

/** The `#rrggbb` foreground and background of a pair in one mode. */
export function pairColors(pair: ContrastPair, mode: 'light' | 'dark'): { fg: string; bg: string } {
  const base = semantic[pair.bg][mode];
  return {
    fg: semantic[pair.fg][mode],
    bg: pair.bgMix ? mixOklab(semantic[pair.bgMix.token][mode], pair.bgMix.percent, base) : base,
  };
}

const text = (fg: SemanticToken, bg: SemanticToken): ContrastPair => ({ fg, bg, min: 4.5 });
/** Tone text on an 8% wash of the same tone over surface (Badge, StatCard delta). */
const tinted = (tone: SemanticToken): ContrastPair => ({
  fg: tone,
  bg: 'surface',
  min: 4.5,
  bgMix: { token: tone, percent: 8 },
});
const ui = (fg: SemanticToken, bg: SemanticToken): ContrastPair => ({ fg, bg, min: 3 });

/** Every text/background and UI-component/background combination used in practice. */
export const contrastPairs: ContrastPair[] = [
  text('text', 'surface-canvas'),
  text('text', 'surface'),
  text('text', 'surface-selected'),
  text('text-muted', 'surface-canvas'),
  text('text-muted', 'surface'),
  text('text-muted', 'surface-selected'),
  text('text-on-accent', 'accent'),
  text('accent-tint-text', 'accent-tint'),
  text('accent', 'surface'),
  text('danger', 'surface'),
  text('danger', 'surface-canvas'),
  text('success', 'surface'),
  text('warning', 'surface'),
  text('info', 'surface'),
  // Badge tones.
  tinted('success'),
  tinted('warning'),
  tinted('danger'),
  tinted('info'),
  // Accent badge / outline Button hover: the derived accent-tint (accent 12% over surface).
  {
    fg: 'accent-tint-text',
    bg: 'surface',
    min: 4.5,
    bgMix: { token: 'accent', percent: 12 },
  },
  // Outline Button text, on the surfaces a row can have.
  text('accent-tint-text', 'surface'),
  text('accent-tint-text', 'surface-selected'),
  text('accent-tint-text', 'surface-canvas'),
  ui('accent', 'surface-canvas'),
  ui('accent', 'surface-selected'),
  ui('border-strong', 'surface'),
  ui('border-strong', 'surface-canvas'),
  ui('focus-ring', 'surface'),
  ui('focus-ring', 'surface-canvas'),
  ui('focus-ring', 'surface-selected'),
];

export { semantic };
