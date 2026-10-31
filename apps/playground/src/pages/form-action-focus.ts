import type { MouseEvent } from 'react';

/** Keep blur validation from moving a form action between pointer down and click. */
export function keepFormActionStable(event: MouseEvent<HTMLButtonElement>) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (document.activeElement?.closest('[data-field-layout]')) event.preventDefault();
}
