export type FieldErrors = Readonly<Record<string, readonly string[]>>;

/** Segment-aware: imagesX is not below images. The empty path is the root. */
export function isPathWithin(path: string, prefix: string): boolean {
  return prefix === '' || path === prefix || path.startsWith(`${prefix}.`);
}

export function scopeErrors(errors: FieldErrors, prefix: string): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([path]) => isPathWithin(path, prefix))
      .map(([path, messages]) => [
        prefix === '' ? path : path === prefix ? '' : path.slice(prefix.length + 1),
        messages,
      ]),
  );
}

export function unclaimedErrors(errors: FieldErrors, fieldPaths: readonly string[]): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(
      ([path]) => !fieldPaths.some((field) => isPathWithin(path, field)),
    ),
  );
}
