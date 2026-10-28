import { vi } from 'vitest';

/** Test helper: stub matchMedia so `(prefers-reduced-motion: reduce)` matches `reduce`. */
export function mockReducedMotion(reduce: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduce : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}
