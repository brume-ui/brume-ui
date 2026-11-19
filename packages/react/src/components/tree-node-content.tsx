import type { ReactNode } from 'react';

export interface TreeNodeContentProps {
  /** The node's name (usually the edit link). */
  primary: ReactNode;
  /** The other columns' values, quieter and in order; each should carry its own key. */
  secondary?: ReactNode[];
  /** The node's actions, pushed to the end edge. */
  actions?: ReactNode;
}

/** A tree node's row content: primary text, muted secondary values, actions aligned to the end. */
export function TreeNodeContent({ primary, secondary, actions }: TreeNodeContentProps) {
  return (
    <div className="br:flex br:min-w-0 br:flex-wrap br:items-center br:gap-x-3 br:gap-y-1">
      <div className="br:min-w-0 br:text-sm br:font-medium br:text-text">{primary}</div>
      {secondary && secondary.length > 0 ? (
        <div className="br:flex br:min-w-0 br:flex-wrap br:items-center br:gap-x-3 br:gap-y-1 br:text-sm br:text-text-muted">
          {secondary}
        </div>
      ) : null}
      {actions ? (
        <div className="br:ms-auto br:flex br:items-center br:gap-1.5">{actions}</div>
      ) : null}
    </div>
  );
}
