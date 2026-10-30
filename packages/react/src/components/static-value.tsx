import type { HTMLAttributes } from 'react';

/** Labelled read-only form value, sharing the standard control typography. */
export function StaticValue(props: Omit<HTMLAttributes<HTMLParagraphElement>, 'className'>) {
  return <p {...props} className="br:text-sm br:text-text br:whitespace-pre-wrap" />;
}
