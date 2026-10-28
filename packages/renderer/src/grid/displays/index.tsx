import type { GridRow, ListColumn } from '@brume-ui/brume-schema';
import type { ReactNode } from 'react';
import { ComponentSlot } from '../../component-slot';
import { EditableCell } from '../editing/editable-cell';
import {
  BadgeDisplay,
  CopyableDisplay,
  LabelDisplay,
  LimitDisplay,
  LinkDisplay,
  ProgressDisplay,
} from './basic';
import { ExpandDisplay, ModalDisplay, TableDisplay } from './content';
import { formatCell } from './format';
import { DownloadableDisplay, ImageDisplay, QrCodeDisplay } from './media';

export { RowExpansion } from './content';
export { formatCell } from './format';

/**
 * One table cell: an inline editor when the column has one, else its display. A component, so
 * displays and editors can use hooks.
 */
export function GridCell({ column, row }: { column: ListColumn; row: GridRow }): ReactNode {
  const display = <DisplayCell column={column} row={row} />;
  if (!column.editor) return display;
  return <EditableCell column={column} row={row} editor={column.editor} display={display} />;
}

/** A cell's display, dispatched on `column.display.type` (plain text without a display). */
function DisplayCell({ column, row }: { column: ListColumn; row: GridRow }): ReactNode {
  const display = column.display;
  const value = row[column.key];
  if (!display) return formatCell(value);
  switch (display.type) {
    case 'text':
      return formatCell(value);
    case 'component':
      return <ComponentSlot ref={display} context={{ row, column: column.key }} />;
    case 'label':
      return <LabelDisplay column={column} display={display} value={value} />;
    case 'badge':
      return <BadgeDisplay column={column} display={display} value={value} />;
    case 'link':
      return (
        <LinkDisplay
          column={column}
          display={display}
          value={value}
          href={row._meta?.href?.[column.key]}
        />
      );
    case 'image':
      return <ImageDisplay column={column} display={display} value={value} />;
    case 'limit':
      return <LimitDisplay column={column} display={display} value={value} />;
    case 'progress':
      return <ProgressDisplay column={column} display={display} value={value} />;
    case 'qrcode':
      return <QrCodeDisplay column={column} display={display} value={value} />;
    case 'copyable':
      return <CopyableDisplay column={column} display={display} value={value} />;
    case 'downloadable':
      return <DownloadableDisplay column={column} display={display} value={value} />;
    case 'expand':
      return <ExpandDisplay column={column} display={display} row={row} />;
    case 'modal':
      return <ModalDisplay column={column} display={display} row={row} />;
    case 'table':
      return <TableDisplay column={column} display={display} row={row} />;
    default:
      // A display type from a newer schema: show the value.
      return formatCell(value);
  }
}

export function renderCell(column: ListColumn, row: GridRow): ReactNode {
  return <GridCell column={column} row={row} />;
}
