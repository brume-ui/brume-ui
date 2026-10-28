import type { ListPage } from '@brume-ui/brume-schema';

/** localStorage key holding the hidden column keys of one grid, as a JSON string array. */
export const COLUMN_VISIBILITY_KEY = (gridId: string) => `brume.grid.${gridId}.hidden`;

function defaults(page: ListPage): Set<string> {
  return new Set(
    page.columns.filter((c) => c.hiddenByDefault && c.hideable !== false).map((c) => c.key),
  );
}

/**
 * The columns this viewer hid on this grid. Anything unreadable (storage blocked, broken JSON, a
 * key that is no longer a column) falls back to the columns' `hiddenByDefault`. Columns with
 * `hideable: false` are never hidden.
 */
export function readHiddenColumns(page: ListPage): Set<string> {
  let stored: unknown;
  try {
    const raw = localStorage.getItem(COLUMN_VISIBILITY_KEY(page.gridId));
    if (raw === null) return defaults(page);
    stored = JSON.parse(raw);
  } catch {
    return defaults(page);
  }
  const known = new Set(page.columns.map((c) => c.key));
  if (
    !Array.isArray(stored) ||
    !stored.every((key): key is string => typeof key === 'string' && known.has(key))
  ) {
    return defaults(page);
  }
  const locked = new Set(page.columns.filter((c) => c.hideable === false).map((c) => c.key));
  return new Set(stored.filter((key) => !locked.has(key)));
}

/** Remembers the hidden columns; a blocked or full storage only loses the preference. */
export function writeHiddenColumns(gridId: string, hidden: Set<string>): void {
  try {
    localStorage.setItem(COLUMN_VISIBILITY_KEY(gridId), JSON.stringify([...hidden]));
  } catch {
    // Private mode / quota: the toggle still works for this visit.
  }
}
