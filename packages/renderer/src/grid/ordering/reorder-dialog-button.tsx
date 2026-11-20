import { Button, ReorderDialog, useBrume } from '@brume-ui/brume-react';
import { ArrowUpDown } from 'lucide-react';
import { useRef, useState } from 'react';
import { useGrid } from '../grid-context';
import { useReorder } from './use-reorder';

type Id = string | number;

/** 「調整順序」: opens a dialog with every item (not only this page) and saves the full order. */
export function ReorderDialogButton() {
  const { page } = useGrid();
  const { t } = useBrume();
  const reorder = useReorder(page);
  const [open, setOpen] = useState(false);
  // One array per load: ReorderDialog resets its working order when `items` changes identity.
  const [items, setItems] = useState<{ id: string; label: string }[] | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  // Brume-react reports string ids; the server gets each item's original value back.
  const originals = useRef(new Map<string, Id>());
  const loads = useRef(0);
  // Bumped on every open and close: a save from an earlier opening must not touch this one.
  const session = useRef(0);

  if (page.ordering?.mode !== 'list' || !page.endpoints?.reorder) return null;

  /** Fetches every item; `keepError` leaves a save failure on screen while the list reloads. */
  async function load({ keepError = false } = {}) {
    const load = ++loads.current;
    setItems(null);
    if (!keepError) setError(undefined);
    try {
      const res = await reorder.loadItems();
      if (load !== loads.current) return;
      originals.current = new Map(res.items.map((item) => [String(item.id), item.id]));
      setItems(res.items.map((item) => ({ id: String(item.id), label: item.label })));
    } catch (e) {
      if (load !== loads.current) return;
      setItems([]);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function changeOpen(next: boolean) {
    session.current++;
    setOpen(next);
    setSaving(false);
    if (next) void load();
    else loads.current++;
  }

  async function save(ids: string[]) {
    const current = session.current;
    setSaving(true);
    setError(undefined);
    try {
      await reorder.saveList(ids.map((id) => originals.current.get(id) ?? id));
      if (current !== session.current) return;
      setOpen(false);
    } catch (e) {
      if (current !== session.current) return;
      // The order changed under us (or the save failed): show why next to the current order.
      setError(e instanceof Error ? e.message : String(e));
      void load({ keepError: true });
    } finally {
      if (current === session.current) setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" iconStart={ArrowUpDown} onClick={() => changeOpen(true)}>
        {t('grid.reorder')}
      </Button>
      <ReorderDialog
        open={open}
        onOpenChange={changeOpen}
        title={t('grid.reorder')}
        items={items}
        error={error}
        saving={saving}
        onSave={(ids) => void save(ids)}
      />
    </>
  );
}
