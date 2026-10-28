import { vi } from 'vitest';

/**
 * jsdom has no layout: give every element a content width so charts measure and draw.
 * Returns a setter for resize tests.
 */
export function stubLayoutWidth(initial = 640): (width: number) => void {
  let width = initial;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  return (next) => {
    width = next;
  };
}
