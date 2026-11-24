/**
 * Runs `write` with `flag.current` true, so the change event the editor fires synchronously while its
 * value is written is not taken for an edit. The flag is reset even when `write` throws: a stuck flag
 * would silently drop every later edit.
 */
export function whileApplying(flag: { current: boolean }, write: () => void): void {
  flag.current = true;
  try {
    write();
  } finally {
    flag.current = false;
  }
}
