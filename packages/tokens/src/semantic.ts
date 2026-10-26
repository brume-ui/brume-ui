export interface ModeValue {
  light: string;
  dark: string;
}

/** Light values follow design spec 5.2; dark values remap the same names. */
export const semantic = {
  'surface-canvas': { light: '#eef2f6', dark: '#0f151c' },
  surface: { light: '#ffffff', dark: '#171f28' },
  'surface-selected': { light: '#f0f8fa', dark: '#16323b' },
  text: { light: '#1f2a37', dark: '#e6ebf0' },
  // Darkened from spec #6b7785 so it passes 4.5:1 on surface-canvas as well.
  'text-muted': { light: '#5b6776', dark: '#9aa8b6' },
  border: { light: '#e3e8ee', dark: '#263140' },
  'border-strong': { light: '#cfd7e0', dark: '#3a4757' },
  accent: { light: '#0e7490', dark: '#38b6d4' },
  // Fallback hex; CSS derives it with color-mix so it follows --br-accent.
  'accent-tint': { light: '#e3f1f4', dark: '#173540' },
  'accent-tint-text': { light: '#0e6f86', dark: '#8fd8ea' },
  'text-on-accent': { light: '#ffffff', dark: '#06222b' },
  'focus-ring': { light: '#0e7490', dark: '#4cc3e0' },
  danger: { light: '#c2412d', dark: '#f08a76' },
  success: { light: '#166d38', dark: '#4ade80' },
  warning: { light: '#8a5a00', dark: '#e5b341' },
  info: { light: '#1d6fb8', dark: '#6cb4f0' },
} as const satisfies Record<string, ModeValue>;

export type SemanticToken = keyof typeof semantic;

/** Tokens whose CSS value is derived instead of a literal hex. */
export const derived: Partial<Record<SemanticToken, string>> = {
  'accent-tint': 'color-mix(in oklab, var(--br-accent) 12%, var(--br-surface))',
};
