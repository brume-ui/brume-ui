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

export interface ContrastPair {
  fg: SemanticToken;
  bg: SemanticToken;
  min: 4.5 | 3;
}

const text = (fg: SemanticToken, bg: SemanticToken): ContrastPair => ({ fg, bg, min: 4.5 });
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
  ui('accent', 'surface-canvas'),
  ui('accent', 'surface-selected'),
  ui('border-strong', 'surface'),
  ui('border-strong', 'surface-canvas'),
  ui('focus-ring', 'surface'),
  ui('focus-ring', 'surface-canvas'),
  ui('focus-ring', 'surface-selected'),
];

export { semantic };
