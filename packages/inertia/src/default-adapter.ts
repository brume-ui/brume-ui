import { createInertiaAdapter } from './adapter';

/** Shared instance so BrumeProvider's context value stays stable across renders. */
export const inertiaAdapter = createInertiaAdapter();
