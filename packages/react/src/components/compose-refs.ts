import { type Ref, useMemo } from 'react';

type Cleanup = (() => void) | undefined;

/**
 * One ref that forwards the node to every given ref (callback refs and ref objects alike).
 * React 19 cleanup-returning callback refs are supported: the composed ref returns a cleanup that
 * runs each of theirs (and nulls the plain ones).
 */
export function composeRefs<T>(...refs: (Ref<T> | undefined)[]): (node: T | null) => () => void {
  return (node) => {
    const cleanups: Cleanup[] = refs.map((ref) => {
      if (typeof ref === 'function') return (ref(node) as Cleanup) ?? undefined;
      if (ref) (ref as { current: T | null }).current = node;
      return undefined;
    });
    return () => {
      refs.forEach((ref, i) => {
        const cleanup = cleanups[i];
        if (typeof cleanup === 'function') cleanup();
        else if (typeof ref === 'function') ref(null);
        else if (ref) (ref as { current: T | null }).current = null;
      });
    };
  };
}

/** `composeRefs`, kept stable while the refs are, so React does not detach and re-attach the node each render. */
export function useComposedRefs<T>(
  ...refs: (Ref<T> | undefined)[]
): (node: T | null) => () => void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs themselves are the dependencies
  return useMemo(() => composeRefs(...refs), refs);
}
