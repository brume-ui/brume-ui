import { Button, Link, ReorderDialog, SortableTree, TreeNodeContent } from '@brume-ui/brume-react';
import { useState } from 'react';
import { createMenuDb, MENU_MAX_DEPTH, respondMenuReorder } from './grid-ordering-data';

interface TreeMove {
  id: string;
  parent: string | null;
  before?: string;
  after?: string;
}

const FRUITS = ['蘋果', '香蕉', '葡萄', '芒果', '鳳梨'].map((label, i) => ({
  id: `f${i + 1}`,
  label,
}));

/** `react.ReorderDialog`: drag, 置頂／置底 and save the full order. */
export function ReorderDialogLab() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>(FRUITS.map((item) => item.id));
  const [items, setItems] = useState(FRUITS);
  return (
    <>
      <Button onClick={() => setOpen(true)}>開啟調整順序</Button>
      <ReorderDialog
        open={open}
        onOpenChange={setOpen}
        title="調整順序"
        items={items}
        onSave={(ids) => {
          const byId = new Map(items.map((item) => [item.id, item]));
          setItems(ids.map((id) => byId.get(id) ?? { id, label: id }));
          setSaved(ids);
          setOpen(false);
        }}
      />
      <output aria-label="已儲存順序">
        已儲存順序：
        {saved.map((id) => FRUITS.find((item) => item.id === id)?.label).join('、')}
      </output>
    </>
  );
}

/** `react.SortableTree` / `react.TreeNodeContent`: a two-level menu moved through the fake menu server. */
export function SortableTreeLab({ content }: { content?: boolean }) {
  const [db] = useState(createMenuDb);
  const [, setVersion] = useState(0);
  const [last, setLast] = useState('尚未移動');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const nodes = db.nodes
    .filter((node) => node.parent === null)
    .flatMap((root) => [root, ...db.nodes.filter((node) => node.parent === root.id)])
    .map((node) => ({
      ...node,
      id: String(node.id),
      parent: node.parent === null ? null : String(node.parent),
    }));
  const move = (m: TreeMove) => {
    const res = respondMenuReorder(db, {
      method: 'post',
      url: '/admin/menus/_brume/reorder',
      body: m,
    });
    setLast(
      res?.status === 200
        ? `已移動 ${db.nodes.find((n) => String(n.id) === m.id)?.name}`
        : '移動被拒絕（409）',
    );
    setVersion((value) => value + 1);
  };
  return (
    <>
      <SortableTree
        nodes={nodes}
        maxDepth={MENU_MAX_DEPTH}
        enabled
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        nodeLabel={(node) => node.name}
        onMove={move}
        renderNode={(node) =>
          content ? (
            <TreeNodeContent
              primary={node.url ? <Link href={`#${node.url}`}>{node.name}</Link> : node.name}
              secondary={node.url ? [<span key="url">{node.url}</span>] : undefined}
              actions={<Button variant="secondary">編輯</Button>}
            />
          ) : (
            <span>{node.name}</span>
          )
        }
      />
      <output aria-label="最近一次移動">{last}</output>
    </>
  );
}
