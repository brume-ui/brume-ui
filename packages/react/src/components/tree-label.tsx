import type { ReactNode } from 'react';

export interface TreeLabelProps {
  /** Level in the tree; 0 is a root and renders the label as is. */
  depth: number;
  children: ReactNode;
}

/** Indent per level below the first; the elbow sits in the first level's slot. */
const STEP_REM = 1.25;

/**
 * A label placed in a hierarchy (a category tree in a grid column): indented by its depth, with a
 * quiet elbow joining it to its parent. The elbow is decoration, outside the children, so a link
 * label keeps its underline to the text alone.
 */
export function TreeLabel({ depth, children }: TreeLabelProps) {
  const level = Math.max(0, Math.floor(depth));
  if (level === 0) return <span data-depth={0}>{children}</span>;
  return (
    <span
      data-depth={level}
      className="br:inline-flex br:max-w-full br:items-center br:gap-2"
      style={{ paddingInlineStart: `${(level - 1) * STEP_REM}rem` }}
    >
      <span
        aria-hidden="true"
        className="br:-mt-[0.55em] br:ms-1 br:h-[0.7em] br:w-2.5 br:shrink-0 br:rounded-bl-[4px] br:border-b-[1.5px] br:border-l-[1.5px] br:border-border-strong"
      />
      <span className="br:min-w-0">{children}</span>
    </span>
  );
}
