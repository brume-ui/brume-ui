import { useContext } from 'react';
import { cn } from '../cn';
import { FieldLayoutContext } from './field';
import { safeHtmlToReact } from './safe-html';

/** Same caption as a Field label, so a labelled block lines up with real fields. */
const CAPTION = 'br:text-[13px] br:leading-5 br:font-medium br:text-text-label';

/** Help-text typography; the rebuilt elements carry no classes of their own, so lists and code are styled from here. */
const CONTENT = [
  'br:min-w-0 br:text-[13px] br:leading-5 br:text-text-muted',
  'br:[&_p+p]:mt-1.5 br:[&_ul]:list-disc br:[&_ol]:list-decimal br:[&_ul]:pl-5 br:[&_ol]:pl-5',
  'br:[&_ul]:my-1 br:[&_ol]:my-1 br:[&_code]:rounded-[4px] br:[&_code]:bg-surface-canvas',
  'br:[&_code]:px-1 br:[&_code]:font-mono br:[&_code]:text-[12px] br:[&_code]:text-text',
  'br:[&_strong]:font-medium br:[&_strong]:text-text br:[&_b]:font-medium br:[&_b]:text-text',
].join(' ');

/**
 * A developer-written HTML snippet inside a form (the `html` layout node): rebuilt from a small
 * whitelist (see safeHtmlToReact), never injected as markup. With `label` it lays out like a field
 * row; without it spans the form width.
 */
export function FormHtml({ html, label }: { html: string; label?: string }) {
  const layout = useContext(FieldLayoutContext);
  const content = <div className={CONTENT}>{safeHtmlToReact(html)}</div>;
  if (label === undefined || label === '') {
    return <div data-html-layout="block">{content}</div>;
  }
  return (
    <div
      data-html-layout={layout}
      className={cn(
        'br:grid br:grid-cols-1 br:gap-x-4 br:gap-y-1.5',
        layout === 'horizontal' &&
          'br:@min-[480px]:grid-cols-[8rem_1fr] br:@min-[480px]:[&>span]:text-right',
      )}
    >
      <span className={CAPTION}>{label}</span>
      {content}
    </div>
  );
}
