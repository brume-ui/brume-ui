import { X } from 'lucide-react';
import { IconButton } from './icon-button';

export interface ChipProps {
  /** Muted prefix (the filter name); omit for a value-only chip (Combobox selections). */
  label?: string;
  value: string;
  onRemove(): void;
  /** Accessible name of the ✕ button, e.g. 「移除篩選：狀態」. */
  removeLabel: string;
}

/** Pill showing `label value` with a ✕ to remove it (active filters, multi-select values). */
export function Chip({ label, value, onRemove, removeLabel }: ChipProps) {
  return (
    <span className="br:inline-flex br:h-7 br:max-w-full br:items-center br:gap-1.5 br:rounded-pill br:border br:border-border br:bg-surface br:pr-0.5 br:pl-3 br:text-xs br:text-text">
      {label ? <span className="br:shrink-0 br:text-text-muted">{label}</span> : null}
      <span className="br:min-w-0 br:truncate br:font-semibold">{value}</span>
      <IconButton
        icon={X}
        label={removeLabel}
        onClick={onRemove}
        className="br:size-6 br:shrink-0 br:text-text-muted br:hover:text-text br:[&>svg]:size-3.5"
      />
    </span>
  );
}
