import {
  Button,
  EmptyState,
  SortableTree,
  type TreeNode,
  TreeNodeContent,
  useBrume,
} from '@brume-ui/brume-react';
import type { GridRow, ListPage } from '@brume-ui/brume-schema';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { hasRowActions, PrimaryCell, RowActions, RowMenu, rowLabel } from '../actions/row-actions';
import { renderCell } from '../displays';
import { useGridEmptyState } from '../empty';
import { useGrid } from '../grid-context';
import { useReorder } from './use-reorder';

/** localStorage key holding the collapsed node ids of one tree grid, as a JSON string array. */
export const TREE_COLLAPSED_KEY = (gridId: string) => `brume.grid.${gridId}.collapsed`;

function readCollapsed(gridId: string): Set<string> {
  try {
    const raw = localStorage.getItem(TREE_COLLAPSED_KEY(gridId));
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

function writeCollapsed(gridId: string, collapsed: ReadonlySet<string>): void {
  try {
    localStorage.setItem(TREE_COLLAPSED_KEY(gridId), JSON.stringify([...collapsed]));
  } catch {
    // Storage blocked or full: the tree still collapses for this visit.
  }
}

export interface TreeCollapse {
  collapsed: ReadonlySet<string>;
  setCollapsed(next: Set<string>): void;
}

/** The collapsed nodes of a tree grid, remembered per `gridId` (never touched in list mode). */
export function useTreeCollapse(page: ListPage): TreeCollapse {
  const tree = page.ordering?.mode === 'tree';
  const [state, setState] = useState(() => ({
    gridId: page.gridId,
    collapsed: tree ? readCollapsed(page.gridId) : new Set<string>(),
  }));
  let current = state;
  if (state.gridId !== page.gridId) {
    current = { gridId: page.gridId, collapsed: tree ? readCollapsed(page.gridId) : new Set() };
    setState(current);
  }
  const gridId = page.gridId;
  const setCollapsed = useCallback(
    (next: Set<string>) => {
      setState({ gridId, collapsed: next });
      writeCollapsed(gridId, next);
    },
    [gridId],
  );
  return { collapsed: current.collapsed, setCollapsed };
}

interface RowNode extends TreeNode {
  row: GridRow;
}

/** 「全部展開」「全部收合」: every node with children, or none. */
export function TreeToolbarButtons({ collapse }: { collapse: TreeCollapse }) {
  const { page } = useGrid();
  const { t } = useBrume();
  const parents = useMemo(
    () =>
      new Set(
        page.rows.flatMap((row) => (row._meta?.parent == null ? [] : [String(row._meta.parent)])),
      ),
    [page.rows],
  );
  if (parents.size === 0) return null;
  return (
    <>
      <Button
        variant="secondary"
        iconStart={ChevronsUpDown}
        onClick={() => collapse.setCollapsed(new Set())}
      >
        {t('grid.expandAll')}
      </Button>
      <Button
        variant="secondary"
        iconStart={ChevronsDownUp}
        onClick={() => collapse.setCollapsed(new Set(parents))}
      >
        {t('grid.collapseAll')}
      </Button>
    </>
  );
}

/** The grid's body in tree mode: every row as a node of a hierarchy reordered by dragging. */
export function TreeView({
  collapse,
  hidden,
}: {
  collapse: TreeCollapse;
  hidden: ReadonlySet<string>;
}) {
  const { page, onEdit } = useGrid();
  const reorder = useReorder(page);
  const empty = useGridEmptyState();

  // SortableTree keys its carry and optimistic state on this array: one per set of rows.
  const nodes = useMemo<RowNode[]>(
    () =>
      page.rows.map((row) => ({
        id: String(row.id),
        parent: row._meta?.parent == null ? null : String(row._meta.parent),
        row,
      })),
    [page.rows],
  );
  // The tree reports string ids; the server wants each row's own value.
  const original = useMemo(() => new Map(page.rows.map((r) => [String(r.id), r.id])), [page.rows]);

  const primary = page.columns.find((c) => c.primary) ?? page.columns[0];
  const secondary = page.columns.filter((c) => c !== primary && !hidden.has(c.key));
  const canEdit = Boolean(onEdit) || page.rows.some((row) => row._meta?.editUrl);
  const withActions = hasRowActions(page, canEdit);

  if (page.rows.length === 0) return <EmptyState {...empty} />;

  return (
    <SortableTree
      nodes={nodes}
      nodeLabel={(node) => rowLabel(page, node.row)}
      maxDepth={page.ordering?.maxDepth}
      enabled={Boolean(page.endpoints?.reorder)}
      collapsed={collapse.collapsed}
      onCollapsedChange={collapse.setCollapsed}
      onMove={(m) => {
        const id = (key: string) => original.get(key) ?? key;
        return reorder.move({
          id: id(m.id),
          parent: m.parent === null ? null : id(m.parent),
          ...(m.before !== undefined ? { before: id(m.before) } : {}),
          ...(m.after !== undefined ? { after: id(m.after) } : {}),
        });
      }}
      renderNode={({ row }) => (
        <RowMenu row={row}>
          <div>
            <TreeNodeContent
              primary={primary ? <PrimaryCell column={primary} row={row} /> : `#${row.id}`}
              secondary={secondary
                .filter((col) => col.display?.type === 'component' || hasValue(row[col.key]))
                .map((col) => <span key={col.key}>{renderCell(col, row)}</span>)}
              actions={withActions ? <RowActions row={row} /> : undefined}
            />
          </div>
        </RowMenu>
      )}
    />
  );
}

const hasValue = (value: unknown) => value !== null && value !== undefined && value !== '';
