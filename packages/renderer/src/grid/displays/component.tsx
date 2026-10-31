import type { ComponentRef, GridRow } from '@brume-ui/brume-schema';
import { ComponentSlot } from '../../component-slot';
import { useRegistry } from '../../registry-context';

/** Custom displays keep their own semantics, including any interactive descendants. */
export function ComponentDisplay({
  display,
  row,
  column,
}: {
  display: ComponentRef;
  row: GridRow;
  column: string;
}) {
  const Component = useRegistry().getDisplay(display.name);
  if (Component)
    return <Component value={row[column]} row={row} column={column} props={display.props ?? {}} />;
  return <ComponentSlot ref={display} context={{ row, column }} />;
}
