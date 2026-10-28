import {
  ActionMenu,
  Button,
  isPlainClick,
  Link,
  LinkButton,
  type MenuAction,
  RowContextMenu,
  resolveIcon,
  useBrume,
} from '@brume-ui/brume-react';
import type { ActionDef, GridRow, ListColumn, ListPage } from '@brume-ui/brume-schema';
import { Pencil } from 'lucide-react';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { formatCell, GridCell } from '../displays';
import { useGrid } from '../grid-context';
import { useActionRunner } from './run-action';

/** At most this many exposed actions show as buttons on the row (row-actions mockup B). */
const MAX_EXPOSED = 2;

export interface RowMenuHandlers {
  /** Opens the row for editing; without it there is no 「編輯」 item. */
  edit?(): void;
  /** Runs a row action on this row; without it the row actions are left out. */
  run?(def: ActionDef): void;
  /** Whether that action is already running on this row (its item is disabled meanwhile). */
  isRunning?(def: ActionDef): boolean;
}

/** The row actions this row allows (`_meta.actions` narrows them; omitted means all). */
export function allowedRowActions(page: ListPage, row: GridRow): ActionDef[] {
  const allowed = row._meta?.actions;
  return allowed ? page.actions.row.filter((a) => allowed.includes(a.key)) : page.actions.row;
}

/**
 * The row's full menu, shared by the ⋯ button and the right-click menu: 「編輯」 (E) first, then
 * the allowed row actions. ActionMenu puts danger items last.
 */
export function rowMenuItems(
  page: ListPage,
  row: GridRow,
  handlers: RowMenuHandlers,
  t: (key: 'grid.edit') => string,
): MenuAction[] {
  const items: MenuAction[] = [];
  const { edit, run, isRunning } = handlers;
  if (edit) {
    items.push({
      key: '__edit',
      label: t('grid.edit'),
      icon: Pencil,
      shortcut: 'E',
      onSelect: edit,
    });
  }
  if (run) {
    for (const def of allowedRowActions(page, row)) {
      items.push({
        key: def.key,
        label: def.label,
        icon: def.icon ? resolveIcon(def.icon) : undefined,
        shortcut: def.shortcut,
        tone: def.tone,
        disabled: isRunning?.(def) || undefined,
        onSelect: () => run(def),
      });
    }
  }
  return items;
}

/** How the row opens for editing: `onEdit` first, else a visit to `_meta.editUrl`. */
function useEditHandler(row: GridRow): (() => void) | undefined {
  const { onEdit } = useGrid();
  const { adapter } = useBrume();
  const editUrl = row._meta?.editUrl;
  if (onEdit) return () => onEdit(row);
  if (editUrl) return () => adapter.visit(editUrl);
  return undefined;
}

/** The name shown for a row in labels: its primary (else first) column, else `#id`. */
export function rowLabel(page: ListPage, row: GridRow): string {
  const col = page.columns.find((c) => c.primary) ?? page.columns[0];
  const text = col ? formatCell(row[col.key]) : '';
  return text || `#${row.id}`;
}

/** Whether the grid needs a row-actions column at all. */
export function hasRowActions(page: ListPage, canEdit: boolean): boolean {
  return canEdit || (page.actions.row.length > 0 && Boolean(page.endpoints?.action));
}

function useRowMenu(row: GridRow) {
  const { page } = useGrid();
  const { t } = useBrume();
  const edit = useEditHandler(row);
  const runner = useActionRunner();
  const { run, isRunning } = runner;
  const items = rowMenuItems(
    page,
    row,
    {
      edit,
      run: run ? (def) => void run(def, 'row', [row.id]) : undefined,
      isRunning: (def) => isRunning(def, 'row', [row.id]),
    },
    t,
  );
  return { items, runner };
}

/** The last cell of a row: up to two exposed actions as pill buttons, then the ⋯ menu. */
export function RowActions({ row }: { row: GridRow }) {
  const { page } = useGrid();
  const { t } = useBrume();
  const { items, runner } = useRowMenu(row);
  const { run, isRunning } = runner;
  if (items.length === 0) return null;
  const exposed = run
    ? allowedRowActions(page, row)
        .filter((a) => a.exposed)
        .slice(0, MAX_EXPOSED)
    : [];
  return (
    <div className="br:inline-flex br:items-center br:justify-end br:gap-1.5">
      {exposed.map((def) => (
        <Button
          key={def.key}
          variant="outline"
          size="sm"
          loading={isRunning(def, 'row', [row.id])}
          onClick={() => void run?.(def, 'row', [row.id])}
        >
          {def.label}
        </Button>
      ))}
      <ActionMenu items={items} label={t('menu.moreActions', { name: rowLabel(page, row) })} />
    </div>
  );
}

/** Wraps a row's `<tr>` so a right click opens the same menu as its ⋯ button. */
export function RowMenu({ row, children }: { row: GridRow; children: ReactElement }) {
  const { items } = useRowMenu(row);
  if (items.length === 0) return children;
  return <RowContextMenu items={items}>{children}</RowContextMenu>;
}

/**
 * The primary column's cell: its text is the edit entry. With an `editUrl` it is a real link
 * (open in a new tab works) whose plain click goes to `onEdit` when there is one; with only
 * `onEdit` it is a link-styled button. Other displays render as usual.
 */
export function PrimaryCell({ column, row }: { column: ListColumn; row: GridRow }): ReactNode {
  const { onEdit } = useGrid();
  const editUrl = row._meta?.editUrl;
  const plain = !column.display || column.display.type === 'text';
  if (!plain || (!onEdit && !editUrl)) return <GridCell column={column} row={row} />;
  const label = formatCell(row[column.key]) || `#${row.id}`;
  if (editUrl) {
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (!onEdit || !isPlainClick(event)) return;
      event.preventDefault();
      onEdit(row);
    };
    return (
      <Link href={editUrl} onClick={handleClick}>
        {label}
      </Link>
    );
  }
  return <LinkButton onClick={() => onEdit?.(row)}>{label}</LinkButton>;
}
