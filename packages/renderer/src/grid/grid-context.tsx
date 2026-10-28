import type { GridRow, ListPage } from '@brume-ui/brume-schema';
import { createContext, useContext } from 'react';

export interface GridContextValue {
  page: ListPage;
  /**
   * `page.rows` with the rows that saved cells returned in their place. Those replacements last
   * until `page.rows` changes (a refresh or another view).
   */
  rows: GridRow[];
  /** Puts a row returned by the server (a saved cell) in place of the row with its id. */
  replaceRow(row: GridRow): void;
  /** Selected row ids as strings (the batch actions, Task 11). */
  selection: ReadonlySet<string>;
  setSelection(next: Set<string>): void;
  /** Opens a row for editing (the primary column's edit entry, Task 11). */
  onEdit?(row: GridRow): void;
  /** Whether the `expand` cell of `key` in row `rowId` is open. */
  isExpanded(rowId: string, key: string): boolean;
  toggleExpanded(rowId: string, key: string): void;
  /** DOM id of that cell's expanded content (for aria-controls). */
  expansionId(rowId: string, key: string): string;
  /**
   * The actions in flight (their `runKey`s), one set for the whole grid so the exposed buttons,
   * the ⋯ menu and the right-click menu of a row all see the same run.
   */
  runningActions: ReadonlySet<string>;
  /** Marks `key` as running; false when it already is (the caller must not send it again). */
  startAction(key: string): boolean;
  endAction(key: string): void;
}

export const GridContext = createContext<GridContextValue | null>(null);

export function useGrid(): GridContextValue {
  const ctx = useContext(GridContext);
  if (!ctx) throw new Error('useGrid must be used inside <GridView>.');
  return ctx;
}
