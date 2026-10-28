/**
 * 2px keyboard-focus ring (it settles outward from the edge in --br-duration-fast) using the focus-ring token (>= 3:1 against surfaces).
 * `outline-none` sets `--tw-outline-style: none`, which `outline-2` reads, so the ring must set
 * its style explicitly (`outline-solid`) or it never shows.
 */
export const FOCUS_RING =
  'br:outline-none br:focus-visible:outline-solid br:focus-visible:outline-2 br:focus-visible:outline-offset-2 br:focus-visible:outline-focus-ring br:focus-visible:animate-[br-focus-ring_var(--br-duration-fast)_var(--br-ease-out)]';

/** The same ring, drawn inside, for menu items that Radix highlights while the keyboard moves. */
export const HIGHLIGHT_RING =
  'br:outline-none br:data-[highlighted]:outline-solid br:data-[highlighted]:outline-2 br:data-[highlighted]:-outline-offset-2 br:data-[highlighted]:outline-focus-ring';

export const CONTROL_BASE =
  'br:rounded-input br:border br:bg-surface br:text-text br:text-sm br:h-10 br:px-3 br:transition-[color,background-color,border-color] br:duration-fast br:ease-out br:disabled:opacity-50 br:disabled:cursor-not-allowed br:placeholder:text-text-muted';

/** Resting border of text-like controls; hover darkens it a step. */
export const CONTROL_BORDER = 'br:border-border-strong br:enabled:hover:border-text-muted';
