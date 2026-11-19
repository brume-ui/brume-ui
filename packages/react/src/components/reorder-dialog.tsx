import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { cn } from '../cn';
import { prefersReducedMotion } from '../motion/reduced-motion';
import { useBrume } from '../provider';
import { Alert } from './alert';
import { Button } from './button';
import { Dialog } from './dialog';
import { DragHandle } from './drag-handle';
import { Skeleton } from './skeleton';
import { useSortableSetup } from './use-sortable-setup';

export interface ReorderDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The caller supplies the localized title (the renderer's default is 「調整順序」). */
  title: string;
  /** `null` while loading (shows a skeleton). */
  items: { id: string; label: string }[] | null;
  /** A load or save failure; shown in the dialog while the list stays usable. */
  error?: string;
  saving?: boolean;
  onSave(ids: string[]): void;
}

/**
 * Below a 480px viewport (the dialog is then narrower than its 420px) the move buttons shrink to
 * their icon (the word stays as the tooltip and the accessible name) so the item name keeps the
 * row. Viewport breakpoints on purpose: no container queries inside dialogs.
 */
const COMPACT = 'br:px-1.5 br:min-[480px]:px-3';
/** Two lines of name when narrow, one with an ellipsis when there is room. */
const NAME = 'br:line-clamp-2 br:min-[480px]:line-clamp-none br:min-[480px]:truncate';
const WORD = 'br:hidden br:min-[480px]:inline';

function ReorderRow({
  id,
  label,
  index,
  last,
  onTop,
  onBottom,
}: {
  id: string;
  label: string;
  index: number;
  last: boolean;
  onTop(): void;
  onBottom(): void;
}) {
  const { t } = useBrume();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: prefersReducedMotion() ? null : undefined });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: prefersReducedMotion() ? undefined : transition,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging || undefined}
      className={cn(
        'br:flex br:items-center br:gap-2 br:min-[480px]:gap-3 br:rounded-input br:border br:border-border br:bg-surface br:px-2 br:py-1.5',
        'br:data-dragging:bg-accent-tint br:data-dragging:shadow-overlay',
      )}
    >
      <DragHandle
        ref={setActivatorNodeRef}
        label={t('dataTable.dragHandle', { label })}
        {...attributes}
        {...listeners}
      />
      <span className="br:w-5 br:min-[480px]:w-6 br:shrink-0 br:text-right br:text-sm br:text-text-muted br:tabular-nums">
        {index + 1}
      </span>
      <span className={cn('br:min-w-0 br:flex-1 br:text-sm br:break-words', NAME)}>{label}</span>
      <span className="br:flex br:shrink-0 br:gap-0.5 br:min-[480px]:gap-1">
        {index > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            iconStart={ArrowUpToLine}
            className={COMPACT}
            aria-label={t('reorderDialog.topLabel', { label })}
            title={t('reorderDialog.top')}
            onClick={onTop}
          >
            <span className={WORD}>{t('reorderDialog.top')}</span>
          </Button>
        ) : null}
        {!last ? (
          <Button
            variant="ghost"
            size="sm"
            iconStart={ArrowDownToLine}
            className={COMPACT}
            aria-label={t('reorderDialog.bottomLabel', { label })}
            title={t('reorderDialog.bottom')}
            onClick={onBottom}
          >
            <span className={WORD}>{t('reorderDialog.bottom')}</span>
          </Button>
        ) : null}
      </span>
    </li>
  );
}

/**
 * A compact dialog for reordering a flat list of named items by drag, keyboard or the
 * move-to-top / move-to-bottom buttons. Calls `onSave` with the ids in their new order.
 */
export function ReorderDialog({
  open,
  onOpenChange,
  title,
  items,
  error,
  saving = false,
  onSave,
}: ReorderDialogProps) {
  const { t } = useBrume();
  const [local, setLocal] = useState<{ source: typeof items; ids: string[] | null }>({
    source: items,
    ids: null,
  });
  // A new items array (reopened, reloaded) starts a fresh working order.
  if (local.source !== items) setLocal({ source: items, ids: null });
  const baseIds = items?.map((i) => i.id) ?? [];
  const ids = local.ids ?? baseIds;
  const labels = new Map((items ?? []).map((i) => [i.id, i.label]));
  const changed = ids.some((id, i) => id !== baseIds[i]);
  const setIds = (next: string[]) => setLocal({ source: items, ids: next });

  const nameOf = (id: string) => labels.get(id) ?? id;
  const dnd = useSortableSetup(nameOf, (id) => ids.indexOf(id) + 1);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) setIds(arrayMove(ids, from, to));
  };
  const move = (id: string, to: 'top' | 'bottom') =>
    setIds([
      ...(to === 'top' ? [id] : []),
      ...ids.filter((x) => x !== id),
      ...(to === 'bottom' ? [id] : []),
    ]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            data-dialog-primary=""
            loading={saving}
            disabled={items === null || !changed || saving}
            onClick={() => onSave(ids)}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="br:flex br:flex-col br:gap-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {items === null ? (
          <div aria-busy="true" className="br:flex br:flex-col br:gap-2">
            {[0, 1, 2, 3].map((n) => (
              <Skeleton key={n} className="br:h-9 br:w-full br:rounded-input" />
            ))}
          </div>
        ) : (
          <DndContext {...dnd} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ol className="br:m-0 br:flex br:list-none br:flex-col br:gap-1.5 br:p-0">
                {ids.map((id, index) => (
                  <ReorderRow
                    key={id}
                    id={id}
                    label={nameOf(id)}
                    index={index}
                    last={index === ids.length - 1}
                    onTop={() => move(id, 'top')}
                    onBottom={() => move(id, 'bottom')}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </Dialog>
  );
}
