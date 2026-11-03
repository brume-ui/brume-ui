/** Non-color scales. Spacing is a 4px grid; everything is exposed as `--br-*`. */
export const spacingBase = '4px';

/**
 * Two working radii (design rules, ui-polish-brief-2): 6px for controls (inputs, buttons, menus,
 * chips' hit areas) and 10px for containers (cards, upload tiles); dialogs one step rounder.
 * `pill` is reserved for status badges, filter chips, switches and progress tracks.
 */
export const radius = {
  input: '6px',
  card: '10px',
  dialog: '12px',
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
