/** Non-color scales. Spacing is a 4px grid; everything is exposed as `--br-*`. */
export const spacingBase = '4px';

export const radius = {
  input: '8px',
  card: '12px',
  dialog: '14px',
  pill: '999px',
} as const;

export const shadow = {
  flat: 'none',
  row: '0 1.5px 0 rgba(31, 42, 55, 0.07)',
  overlay: '0 12px 32px -8px rgba(15, 21, 28, 0.18), 0 2px 6px rgba(15, 21, 28, 0.06)',
} as const;

export const font = {
  sans: '"Nunito", "jf-openhuninn", "Noto Sans TC", system-ui, sans-serif',
} as const;

/** Row height for the default density. */
export const rowHeight = '44px';
