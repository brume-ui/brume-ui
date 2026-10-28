import type { GridRow, ListPage } from '@brume-ui/brume-schema';
import { createContext, useContext } from 'react';

export interface GridContextValue {
  page: ListPage;
  /** Selected row ids as strings (the batch actions, Task 11). */
  selection: ReadonlySet<string>;
  setSelection(next: Set<string>): void;
  /** Opens a row for editing (the primary column's edit entry, Task 11). */
  onEdit?(row: GridRow): void;
}

export const GridContext = createContext<GridContextValue | null>(null);

export function useGrid(): GridContextValue {
  const ctx = useContext(GridContext);
  if (!ctx) throw new Error('useGrid must be used inside <GridView>.');
  return ctx;
}
