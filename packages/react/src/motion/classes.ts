/**
 * Shared motion class strings. Durations/easings are tokens (`br:duration-*`, `br:ease-*`), so
 * reduced motion is handled by tokens.css; transforms additionally opt out with `motion-reduce:`.
 */

/** Press feedback for buttons: quick colour/opacity transitions and a 0.97 press. */
export const PRESS =
  'br:transition-[color,background-color,border-color,opacity,scale,filter] br:duration-fast br:ease-out br:active:scale-[0.97] br:motion-reduce:active:scale-100';

/**
 * Radix popover content (menus, select, tooltip): scale+fade from the trigger side.
 * `--br-origin` is set per component to the matching `--radix-*-content-transform-origin`.
 */
export const POPOVER_MOTION =
  'br:origin-(--br-origin) br:data-[state=open]:animate-[br-pop-in_var(--br-duration-fast)_var(--br-ease-out)] br:data-[state=delayed-open]:animate-[br-pop-in_var(--br-duration-fast)_var(--br-ease-out)] br:data-[state=closed]:animate-[br-pop-out_var(--br-duration-instant)_var(--br-ease-out)_forwards]';

/** Modal overlay fade. */
export const OVERLAY_MOTION =
  'br:data-[state=open]:animate-[br-fade-in_var(--br-duration-base)_var(--br-ease-out)] br:data-[state=closed]:animate-[br-fade-out_var(--br-duration-fast)_var(--br-ease-out)_forwards]';

/** Modal content: centred scale from 0.96 + fade; exit is faster than enter. */
export const MODAL_MOTION =
  'br:data-[state=open]:animate-[br-pop-in_var(--br-duration-base)_var(--br-ease-out)] br:data-[state=closed]:animate-[br-pop-out_var(--br-duration-fast)_var(--br-ease-out)_forwards]';
