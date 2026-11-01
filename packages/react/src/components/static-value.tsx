import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

/** Labelled read-only form value, sharing the standard control typography. */
export function StaticValue(props: Omit<HTMLAttributes<HTMLParagraphElement>, 'className'>) {
  return (
    <p
      {...props}
      className={cn(
        'br:min-h-10 br:flex br:items-center br:text-sm br:whitespace-pre-wrap',
        props.children === '—' ? 'br:text-text-muted' : 'br:text-text',
      )}
    />
  );
}
