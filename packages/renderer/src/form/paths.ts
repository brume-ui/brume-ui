const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const segments = (path: string) => (path === '' ? [] : path.split('.'));

/** Reads only own properties; unsafe prototype paths are never traversed. */
export function getAt(values: unknown, path: string): unknown {
  let value = values;
  for (const key of segments(path)) {
    if (
      forbidden.has(key) ||
      value === null ||
      typeof value !== 'object' ||
      !Object.hasOwn(value, key)
    )
      return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Immutable dot-path update. Empty paths replace the root. */
export function setAt<T>(values: T, path: string, value: unknown): T {
  const keys = segments(path);
  if (keys.some((key) => forbidden.has(key))) throw new Error('Unsafe value path');
  const update = (current: unknown, index: number): unknown => {
    const key = keys[index];
    if (key === undefined) return value;
    const copy: Record<string, unknown> | unknown[] = Array.isArray(current)
      ? [...current]
      : current !== null && typeof current === 'object'
        ? { ...current }
        : /^(0|[1-9]\d*)$/.test(key)
          ? []
          : {};
    const child =
      current !== null && typeof current === 'object' && Object.hasOwn(current, key)
        ? (current as Record<string, unknown>)[key]
        : undefined;
    Object.defineProperty(copy, key, {
      value: update(child, index + 1),
      enumerable: true,
      configurable: true,
      writable: true,
    });
    return copy;
  };
  return update(values, 0) as T;
}

export function joinPath(base: string, name: string): string {
  return base && name ? `${base}.${name}` : base || name;
}
