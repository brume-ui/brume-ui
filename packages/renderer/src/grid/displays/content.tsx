import { Button, CompactTable, Dialog, useBrume } from '@brume-ui/brume-react';
import type { CellContent, Display, GridRow, ListColumn } from '@brume-ui/brume-schema';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { useState } from 'react';
import { ComponentSlot } from '../../component-slot';
import { useGrid } from '../grid-context';
import { formatCell } from './format';

type DisplayOf<K extends Display['type']> = Extract<Display, { type: K }>;

interface Props<K extends Display['type']> {
  column: ListColumn;
  display: DisplayOf<K>;
  row: GridRow;
}

/** `expand` / `modal` content from `row._meta.content[key]`: text, a table or a registered component. */
export function CellContentView({
  content,
  column,
  row,
}: {
  content: CellContent;
  column: ListColumn;
  row: GridRow;
}) {
  switch (content.type) {
    case 'text':
      return <p className="br:break-words br:whitespace-pre-wrap">{content.text}</p>;
    case 'table':
      return <CompactTable columns={content.columns} rows={content.rows} caption={column.label} />;
    case 'component':
      return <ComponentSlot ref={content} context={{ row, column: column.key }} />;
  }
}

/** Toggles a full-width row under this one (rendered by GridTable through DataTable's rowExpansion). */
export function ExpandDisplay({ column, display, row }: Props<'expand'>) {
  const { t } = useBrume();
  const { isExpanded, toggleExpanded, expansionId } = useGrid();
  if (!row._meta?.content?.[column.key]) return formatCell(row[column.key]);
  const rowId = String(row.id);
  const expanded = isExpanded(rowId, column.key);
  const action = display.label ?? t('grid.display.expand');
  return (
    // Ghost, not the outline pill: it repeats on every row, and the accent is kept for actions.
    <Button
      variant="ghost"
      size="sm"
      iconStart={expanded ? ChevronDown : ChevronRight}
      aria-expanded={expanded}
      aria-controls={expanded ? expansionId(rowId, column.key) : undefined}
      aria-label={t('grid.display.actionOn', { action, label: column.label })}
      onClick={() => toggleExpanded(rowId, column.key)}
    >
      {action}
    </Button>
  );
}

/** The expanded contents of one row, one section per open `expand` column. */
export function RowExpansion({ row, columns }: { row: GridRow; columns: ListColumn[] }) {
  const { expansionId } = useGrid();
  return (
    <div className="br:flex br:flex-col br:gap-4">
      {columns.map((column) => {
        const content = row._meta?.content?.[column.key];
        if (!content) return null;
        return (
          <section
            key={column.key}
            id={expansionId(String(row.id), column.key)}
            aria-label={column.label}
            className="br:whitespace-normal"
          >
            <CellContentView content={content} column={column} row={row} />
          </section>
        );
      })}
    </div>
  );
}

export function ModalDisplay({ column, display, row }: Props<'modal'>) {
  const { t } = useBrume();
  const [open, setOpen] = useState(false);
  const content = row._meta?.content?.[column.key];
  if (!content) return formatCell(row[column.key]);
  const action = display.label ?? t('grid.display.view');
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        iconStart={Eye}
        aria-label={t('grid.display.actionOn', { action, label: column.label })}
        onClick={() => setOpen(true)}
      >
        {action}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={display.title ?? column.label}>
        <CellContentView content={content} column={column} row={row} />
      </Dialog>
    </>
  );
}

export function TableDisplay({ column, display, row }: Props<'table'>) {
  const value = row[column.key];
  const rows = Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    : [];
  if (rows.length === 0) return null;
  return <CompactTable columns={display.columns} rows={rows} caption={column.label} />;
}
